import * as employeeRepo from "../repositories/employee.repository";
import * as payrollRunRepo from "../repositories/payroll-run.repository";
import * as payslipRepo from "../repositories/payslip.repository";
import { calculateMonthlyPaye } from "./paye-calculator";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import type { Employee } from "@prisma/client";
import type { PayslipComputation } from "../repositories/payroll-run.repository";

// Pension Reform Act 2014: employee contributes 8%, employer 10%, both on
// basic + housing + transport (not "other allowances", which the Act treats
// as non-pensionable). NHF is a flat 2.5% of basic salary — a documented
// simplification (see the Phase 5 plan), not means-tested here.
const EMPLOYEE_PENSION_RATE = 0.08;
const EMPLOYER_PENSION_RATE = 0.1;
const NHF_RATE = 0.025;

function computePayslip(employee: Employee): PayslipComputation {
  const basic = Number(employee.basicSalary);
  const housing = Number(employee.housingAllowance);
  const transport = Number(employee.transportAllowance);
  const other = Number(employee.otherAllowances);

  const grossPay = basic + housing + transport + other;
  const pensionable = basic + housing + transport;
  const employeePension = pensionable * EMPLOYEE_PENSION_RATE;
  const employerPension = pensionable * EMPLOYER_PENSION_RATE;
  const nhf = basic * NHF_RATE;
  // Pension and NHF are tax-deductible reliefs under Nigerian tax law —
  // subtracted before PAYE bands are applied (paye-calculator.ts).
  const paye = calculateMonthlyPaye(grossPay, employeePension + nhf);
  const netPay = grossPay - paye - employeePension - nhf;

  return {
    employeeId: employee.id,
    grossPay,
    paye,
    employeePension,
    employerPension,
    nhf,
    netPay,
  };
}

/**
 * Computes payslips for every active employee and saves the run. Re-running
 * for a period whose run is still `draft` recomputes it (e.g. after adding
 * an employee mid-month); a `paid` run is immutable — recomputing settled
 * payroll would silently change what was already disbursed.
 */
export async function runPayroll(orgId: string, periodLabel: string) {
  const existing = await payrollRunRepo.findByPeriod(orgId, periodLabel);
  if (existing?.status === "paid") {
    throw new BusinessRuleViolationError(
      `Payroll for ${periodLabel} is already marked paid and cannot be recomputed`,
    );
  }

  const employees = await employeeRepo.listActiveByOrg(orgId);
  const payslips = employees.map(computePayslip);

  return payrollRunRepo.saveRun(orgId, periodLabel, payslips);
}

export async function listRuns(orgId: string) {
  return payrollRunRepo.listByOrg(orgId);
}

export async function getRun(orgId: string, runId: string) {
  const run = await payrollRunRepo.findById(orgId, runId);
  if (!run) throw new NotFoundError("Payroll run not found");
  const payslips = await payslipRepo.listByRun(orgId, runId);
  return { run, payslips };
}

// Attestation-only, mirrors compliance.service.ts's markFiled — "the money
// actually moved" is asserted by the org, not verified by VELA (Phase 5's
// scope decision: no real disbursement integration).
export async function markRunPaid(orgId: string, runId: string) {
  const run = await payrollRunRepo.findById(orgId, runId);
  if (!run) throw new NotFoundError("Payroll run not found");
  return payrollRunRepo.markPaid(orgId, runId);
}
