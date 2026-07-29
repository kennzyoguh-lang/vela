import { withOrgScope } from "../lib/prisma";
import type { Payslip } from "@prisma/client";

export async function listByRun(orgId: string, payrollRunId: string): Promise<Payslip[]> {
  return withOrgScope(orgId, (tx) =>
    tx.payslip.findMany({ where: { orgId, payrollRunId }, orderBy: { createdAt: "asc" } }),
  );
}

export async function findById(orgId: string, payslipId: string): Promise<Payslip | null> {
  return withOrgScope(orgId, (tx) => tx.payslip.findFirst({ where: { id: payslipId, orgId } }));
}
