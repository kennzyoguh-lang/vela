import * as branchRepo from "../repositories/branch.repository";
import * as userRepo from "../repositories/user.repository";
import { NotFoundError } from "../lib/errors";
import type { BranchInput } from "../repositories/branch.repository";

export async function createBranch(orgId: string, input: BranchInput) {
  return branchRepo.create(orgId, input);
}

export async function getBranch(orgId: string, branchId: string) {
  const branch = await branchRepo.findById(orgId, branchId);
  if (!branch) throw new NotFoundError("Branch not found");
  return branch;
}

export async function listBranches(orgId: string) {
  return branchRepo.listActiveByOrg(orgId);
}

export async function updateBranch(orgId: string, branchId: string, input: Partial<BranchInput>) {
  await getBranch(orgId, branchId); // 404s before attempting the update
  return branchRepo.update(orgId, branchId, input);
}

export async function deactivateBranch(orgId: string, branchId: string) {
  await getBranch(orgId, branchId);
  return branchRepo.deactivate(orgId, branchId);
}

export async function assignStaffToBranch(orgId: string, userId: string, branchId: string | null) {
  const user = await userRepo.findById(orgId, userId);
  if (!user) throw new NotFoundError("Staff member not found");
  if (branchId !== null) await getBranch(orgId, branchId); // 404s on a cross-org/missing branch
  await branchRepo.assignStaff(orgId, userId, branchId);
}
