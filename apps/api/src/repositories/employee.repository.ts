import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { Employee, EmploymentType } from "@prisma/client";

export interface EmployeeInput {
  name: string;
  email?: string;
  jobTitle: string;
  employmentType: EmploymentType;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  annualRentPaid?: number;
  startDate: Date;
}

export async function create(orgId: string, input: EmployeeInput): Promise<Employee> {
  return withOrgScope(orgId, (tx) =>
    tx.employee.create({
      data: {
        id: randomUUID(),
        orgId,
        name: input.name,
        email: input.email,
        jobTitle: input.jobTitle,
        employmentType: input.employmentType,
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance ?? 0,
        transportAllowance: input.transportAllowance ?? 0,
        otherAllowances: input.otherAllowances ?? 0,
        annualRentPaid: input.annualRentPaid ?? 0,
        startDate: input.startDate,
      },
    }),
  );
}

export async function findById(orgId: string, employeeId: string): Promise<Employee | null> {
  return withOrgScope(orgId, (tx) => tx.employee.findFirst({ where: { id: employeeId, orgId } }));
}

export async function listActiveByOrg(orgId: string): Promise<Employee[]> {
  return withOrgScope(orgId, (tx) =>
    tx.employee.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" } }),
  );
}

export async function update(
  orgId: string,
  employeeId: string,
  input: Partial<EmployeeInput & { isActive: boolean }>,
): Promise<Employee> {
  return withOrgScope(orgId, (tx) =>
    tx.employee.update({ where: { id: employeeId, orgId }, data: input }),
  );
}
