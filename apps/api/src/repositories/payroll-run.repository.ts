import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { PayrollRun } from "@prisma/client";

export interface PayslipComputation {
  employeeId: string;
  grossPay: number;
  paye: number;
  employeePension: number;
  employerPension: number;
  nhf: number;
  netPay: number;
}

export async function findByPeriod(orgId: string, periodLabel: string): Promise<PayrollRun | null> {
  return withOrgScope(orgId, (tx) => tx.payrollRun.findFirst({ where: { orgId, periodLabel } }));
}

export async function findById(orgId: string, runId: string): Promise<PayrollRun | null> {
  return withOrgScope(orgId, (tx) => tx.payrollRun.findFirst({ where: { id: runId, orgId } }));
}

export async function listByOrg(orgId: string): Promise<PayrollRun[]> {
  return withOrgScope(orgId, (tx) =>
    tx.payrollRun.findMany({ where: { orgId }, orderBy: { periodLabel: "desc" } }),
  );
}

/**
 * Creates the run, or — if a still-`draft` run for this period already
 * exists — replaces its payslips, all inside one transaction so a recompute
 * can never leave stale and fresh payslips coexisting. payroll.service.ts's
 * runPayroll checks the run isn't already `paid` before ever calling this.
 */
export async function saveRun(
  orgId: string,
  periodLabel: string,
  payslips: PayslipComputation[],
): Promise<PayrollRun> {
  return withOrgScope(orgId, async (tx) => {
    const existing = await tx.payrollRun.findFirst({ where: { orgId, periodLabel } });

    const totals = payslips.reduce(
      (acc, p) => ({
        grossPay: acc.grossPay + p.grossPay,
        deductions: acc.deductions + p.paye + p.employeePension + p.nhf,
        netPay: acc.netPay + p.netPay,
      }),
      { grossPay: 0, deductions: 0, netPay: 0 },
    );

    const run = existing
      ? await tx.payrollRun.update({
          where: { id: existing.id },
          data: {
            totalGrossPay: totals.grossPay,
            totalDeductions: totals.deductions,
            totalNetPay: totals.netPay,
          },
        })
      : await tx.payrollRun.create({
          data: {
            id: randomUUID(),
            orgId,
            periodLabel,
            totalGrossPay: totals.grossPay,
            totalDeductions: totals.deductions,
            totalNetPay: totals.netPay,
          },
        });

    if (existing) {
      await tx.payslip.deleteMany({ where: { payrollRunId: run.id } });
    }

    if (payslips.length > 0) {
      await tx.payslip.createMany({
        data: payslips.map((p) => ({
          id: randomUUID(),
          orgId,
          payrollRunId: run.id,
          employeeId: p.employeeId,
          grossPay: p.grossPay,
          paye: p.paye,
          employeePension: p.employeePension,
          employerPension: p.employerPension,
          nhf: p.nhf,
          netPay: p.netPay,
        })),
      });
    }

    return run;
  });
}

export async function markPaid(orgId: string, runId: string): Promise<PayrollRun> {
  return withOrgScope(orgId, (tx) =>
    tx.payrollRun.update({ where: { id: runId, orgId }, data: { status: "paid" } }),
  );
}
