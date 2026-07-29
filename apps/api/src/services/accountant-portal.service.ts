import * as accountantLinkRepo from "../repositories/accountant-link.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as complianceService from "./compliance.service";
import * as bankAccountRepo from "../repositories/bank-account.repository";
import * as payrollRunRepo from "../repositories/payroll-run.repository";
import {
  NotFoundError,
  InsufficientPermissionError,
  BusinessRuleViolationError,
} from "../lib/errors";

const OUTSTANDING_INVOICE_STATUSES = ["sent", "viewed", "partially_paid", "overdue"];

function currentPeriodLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Accountant-side — mirrors organisation.service.ts's shape where useful,
// but every function here operates cross-org, so orgId is never taken from
// the caller's own auth context (that's always the accountant's OWN org).
export async function listMyLinks(userId: string, email: string) {
  const links = await accountantLinkRepo.listForAccountant(userId, email);
  return Promise.all(
    links.map(async (link) => {
      const org = await organisationRepo.findOrganisationById(link.orgId);
      return { ...link, orgName: org?.name ?? "Unknown organisation" };
    }),
  );
}

export async function acceptLink(userId: string, email: string, linkId: string) {
  const links = await accountantLinkRepo.listForAccountant(userId, email);
  const link = links.find((l) => l.id === linkId);
  if (!link) throw new NotFoundError("Invitation not found");
  if (link.status !== "pending") {
    throw new BusinessRuleViolationError("This invitation is no longer pending");
  }
  return accountantLinkRepo.accept(link.orgId, linkId, userId);
}

/**
 * The one access check every cross-org read in this module goes through —
 * looked up INSIDE clientOrgId's own RLS scope (Handbook 6.3: never by
 * loosening any table's policy). If no active link row is found for this
 * exact user, nothing else in this org is ever read.
 */
export async function getClientOrgSummary(userId: string, clientOrgId: string) {
  const activeLink = await accountantLinkRepo.findActiveLink(clientOrgId, userId);
  if (!activeLink) {
    throw new InsufficientPermissionError("You don't have access to this organisation");
  }

  const [organisation, invoices, filings, accounts, payrollRuns] = await Promise.all([
    organisationRepo.findOrganisationById(clientOrgId),
    invoiceRepo.listByOrg(clientOrgId),
    complianceService.listFilings(clientOrgId),
    bankAccountRepo.listActiveByOrg(clientOrgId),
    payrollRunRepo.listByOrg(clientOrgId),
  ]);

  const outstandingInvoices = invoices.filter((i) =>
    OUTSTANDING_INVOICE_STATUSES.includes(i.status),
  );
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + Number(i.total), 0);

  const nextFiling =
    filings
      .filter((f) => f.status !== "filed")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;

  const cashPosition = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);

  const currentPayrollRun = payrollRuns.find((r) => r.periodLabel === currentPeriodLabel()) ?? null;

  return {
    orgName: organisation?.name ?? "Unknown organisation",
    baseCurrency: organisation?.baseCurrency ?? "NGN",
    outstandingInvoicesTotal: outstandingTotal,
    outstandingInvoicesCount: outstandingInvoices.length,
    nextComplianceFiling: nextFiling,
    cashPosition,
    currentPayrollRun,
  };
}
