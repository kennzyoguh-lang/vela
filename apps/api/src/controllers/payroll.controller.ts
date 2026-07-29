import type { Request, Response } from "express";
import * as payrollService from "../services/payroll.service";
import * as employeeRepo from "../repositories/employee.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import { renderPayslipPdf } from "../services/payslip-pdf.service";
import { runPayrollSchema } from "../validation/payroll.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { NotFoundError } from "../lib/errors";

export async function run(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { periodLabel } = runPayrollSchema.parse(req.body);
  const payrollRun = await payrollService.runPayroll(orgId, periodLabel);
  sendSuccess(res, payrollRun, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const runs = await payrollService.listRuns(orgId);
  sendSuccess(res, runs);
}

export async function getOne(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { run: payrollRun, payslips } = await payrollService.getRun(orgId, req.params.runId!);
  sendSuccess(res, { ...payrollRun, payslips });
}

export async function markPaid(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const payrollRun = await payrollService.markRunPaid(orgId, req.params.runId!);
  sendSuccess(res, payrollRun);
}

export async function downloadPayslipPdf(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { run: payrollRun, payslips } = await payrollService.getRun(orgId, req.params.runId!);
  const payslip = payslips.find((p) => p.id === req.params.payslipId);
  if (!payslip) throw new NotFoundError("Payslip not found");

  const employee = await employeeRepo.findById(orgId, payslip.employeeId);
  if (!employee) throw new NotFoundError("Employee not found");
  const organisation = await organisationRepo.findOrganisationById(orgId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="payslip-${payrollRun.periodLabel}-${employee.name}.pdf"`,
  );
  const doc = renderPayslipPdf(payslip, employee, payrollRun, organisation!);
  doc.pipe(res);
  doc.end();
}
