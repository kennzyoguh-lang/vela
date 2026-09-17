import * as accountantLinkRepo from "../repositories/accountant-link.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as complianceService from "./compliance.service";
import { OBLIGATION_RULES } from "./compliance-obligation-rules";
import * as pnlService from "./pnl.service";
import * as emailGateway from "./email/email.gateway";
import { accountantMonthlyReportEmail } from "../email/templates/accountant-monthly-report";
import { logger } from "../lib/logger";

// "YYYY-MM", matching accountant-portal.service.ts's currentPeriodLabel()
// and accountant-earning.service.ts's monthLabel().
function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year!, month! - 1, 1)),
    end: new Date(Date.UTC(year!, month!, 1)),
  };
}

// The month just completed, relative to `now` — called on the 1st of each
// month (accountant-report.job.ts), so "this month" from the job's
// perspective is always the one that just ended.
function previousMonthLabel(now: Date): string {
  return monthLabel(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

/**
 * Builds and sends one client org's monthly summary to its linked
 * accountant — the same figures the accountant portal shows live
 * (accountant-portal.service.ts#getClientOrgSummary), pushed automatically
 * so the accountant never has to remember to log in and check. Never
 * throws: a failure here (bad address, Resend outage, one org's data being
 * momentarily unavailable) must never stop the batch job from reaching
 * every other accountant, same "continue past one failure" contract as
 * owner-summary.service.ts#sendDailySummary.
 */
export async function sendMonthlyReport(
  orgId: string,
  accountantEmail: string,
  month: string,
): Promise<void> {
  try {
    const { start, end } = monthBounds(month);
    const [organisation, pnl, outstandingInvoices, filings] = await Promise.all([
      organisationRepo.findOrganisationById(orgId),
      pnlService.getPnlStatement(orgId, start, end),
      invoiceRepo.listUnpaid(orgId),
      complianceService.listFilings(orgId),
    ]);

    const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + Number(i.total), 0);
    const nextFiling =
      filings
        .filter((f) => f.status !== "filed")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;

    const email = accountantMonthlyReportEmail({
      orgName: organisation?.name ?? "A client",
      month,
      currency: organisation?.baseCurrency ?? "NGN",
      income: pnl.income,
      expensesByCategory: pnl.expensesByCategory,
      netProfit: pnl.netProfit,
      outstandingInvoicesTotal: outstandingTotal,
      outstandingInvoicesCount: outstandingInvoices.length,
      nextComplianceFilingLabel: nextFiling
        ? OBLIGATION_RULES[nextFiling.obligationType].label
        : null,
      nextComplianceFilingDueDate: nextFiling?.dueDate ?? null,
    });

    await emailGateway.sendEmail(accountantEmail, email.subject, email.text, email.html);

    await auditLogRepo.write({
      orgId,
      action: "accountant_report.sent",
      entityType: "organisation",
      entityId: orgId,
      newValue: { accountantEmail, month },
    });
  } catch (err) {
    logger.error(
      { orgId, accountantEmail, month, err },
      "Failed to send accountant monthly report",
    );
  }
}

export async function sendMonthlyReportsForAllAccountants(
  now: Date = new Date(),
): Promise<{ linkCount: number }> {
  const month = previousMonthLabel(now);
  const links = await accountantLinkRepo.listAllActiveLinks();
  for (const link of links) {
    await sendMonthlyReport(link.orgId, link.accountantEmail, month);
  }
  return { linkCount: links.length };
}
