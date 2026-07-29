import { z } from "zod";

// Mirrors apps/web/lib/validation/payroll.schema.ts.
export const createEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  jobTitle: z.string().min(1).max(200),
  employmentType: z.enum(["full_time", "part_time", "contract"]),
  basicSalary: z.number().nonnegative(),
  housingAllowance: z.number().nonnegative().default(0),
  transportAllowance: z.number().nonnegative().default(0),
  otherAllowances: z.number().nonnegative().default(0),
  startDate: z.coerce.date(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const runPayrollSchema = z.object({
  periodLabel: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type RunPayrollInput = z.infer<typeof runPayrollSchema>;
