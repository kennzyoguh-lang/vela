import { z } from "zod";

export const createBranchSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(240).optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(240).optional(),
});

export const assignStaffBranchSchema = z.object({
  // Null unassigns the staff member from any branch — the common case for
  // a single-branch org, or when a branch is retired.
  branchId: z.string().uuid().nullable(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type AssignStaffBranchInput = z.infer<typeof assignStaffBranchSchema>;
