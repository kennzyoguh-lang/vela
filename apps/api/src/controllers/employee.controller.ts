import type { Request, Response } from "express";
import * as employeeService from "../services/employee.service";
import { createEmployeeSchema, updateEmployeeSchema } from "../validation/payroll.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createEmployeeSchema.parse(req.body);
  const employee = await employeeService.createEmployee(orgId, input);
  sendSuccess(res, employee, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const employees = await employeeService.listEmployees(orgId);
  sendSuccess(res, employees);
}

export async function getOne(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const employee = await employeeService.getEmployee(orgId, req.params.employeeId!);
  sendSuccess(res, employee);
}

export async function update(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = updateEmployeeSchema.parse(req.body);
  const employee = await employeeService.updateEmployee(orgId, req.params.employeeId!, input);
  sendSuccess(res, employee);
}
