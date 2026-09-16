import { withOrgScope } from "../lib/prisma";

// F-63 — every entity type the feature promises ("transactions, invoices,
// employees, payroll runs, compliance records"). Deliberately excludes
// anything security-sensitive that isn't the org's own business data:
// password hashes, 2FA secrets/backup-code hashes, PIN hashes, refresh-
// token hashes, and third-party bank access tokens (none of which the
// export's purpose — NDPR right-to-portability of the org's own business
// records — requires, and all of which would turn a portability feature
// into a credential-leak surface).
export async function gatherOrgExport(orgId: string) {
  return withOrgScope(orgId, async (tx) => {
    const [
      organisation,
      users,
      clients,
      invoices,
      employees,
      payrollRuns,
      payslips,
      complianceObligations,
      complianceFilings,
      bankAccounts,
      bankTransactions,
      products,
      sales,
      saleItems,
    ] = await Promise.all([
      tx.organisation.findUnique({ where: { id: orgId } }),
      tx.user.findMany({
        where: { orgId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      tx.client.findMany({ where: { orgId } }),
      tx.invoice.findMany({ where: { orgId } }),
      tx.employee.findMany({ where: { orgId } }),
      tx.payrollRun.findMany({ where: { orgId } }),
      tx.payslip.findMany({ where: { orgId } }),
      tx.orgComplianceObligation.findMany({ where: { orgId } }),
      tx.complianceFiling.findMany({ where: { orgId } }),
      tx.bankAccount.findMany({
        where: { orgId },
        select: {
          id: true,
          provider: true,
          institutionName: true,
          accountType: true,
          accountNumberMasked: true,
          currency: true,
          currentBalance: true,
          lastSyncedAt: true,
          isActive: true,
          createdAt: true,
        },
      }),
      tx.bankTransaction.findMany({ where: { orgId } }),
      tx.product.findMany({ where: { orgId } }),
      tx.sale.findMany({ where: { orgId } }),
      tx.saleItem.findMany({ where: { orgId } }),
    ]);

    return {
      organisation,
      users,
      clients,
      invoices,
      employees,
      payrollRuns,
      payslips,
      complianceObligations,
      complianceFilings,
      bankAccounts,
      bankTransactions,
      products,
      sales,
      saleItems,
    };
  });
}
