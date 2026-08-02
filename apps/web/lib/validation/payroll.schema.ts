import { z } from "zod";

// Mirrors apps/api/src/validation/payroll.schema.ts.
export const createEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  jobTitle: z.string().min(1, "Job title is required").max(200),
  employmentType: z.enum(["full_time", "part_time", "contract"]),
  basicSalary: z.coerce.number().nonnegative("Must be 0 or more"),
  housingAllowance: z.coerce.number().nonnegative().default(0),
  transportAllowance: z.coerce.number().nonnegative().default(0),
  otherAllowances: z.coerce.number().nonnegative().default(0),
  annualRentPaid: z.coerce.number().nonnegative().default(0),
  startDate: z.string().min(1, "Choose a start date"),
});

export type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>;
