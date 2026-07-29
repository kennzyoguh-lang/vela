import * as employeeRepo from "../repositories/employee.repository";
import { NotFoundError } from "../lib/errors";
import type { EmployeeInput } from "../repositories/employee.repository";

export async function createEmployee(orgId: string, input: EmployeeInput) {
  return employeeRepo.create(orgId, input);
}

export async function getEmployee(orgId: string, employeeId: string) {
  const employee = await employeeRepo.findById(orgId, employeeId);
  if (!employee) throw new NotFoundError("Employee not found");
  return employee;
}

export async function listEmployees(orgId: string) {
  return employeeRepo.listActiveByOrg(orgId);
}

export async function updateEmployee(
  orgId: string,
  employeeId: string,
  input: Partial<EmployeeInput>,
) {
  await getEmployee(orgId, employeeId); // 404s before attempting the update
  return employeeRepo.update(orgId, employeeId, input);
}
