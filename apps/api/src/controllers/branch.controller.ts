import type { Request, Response } from "express";
import * as branchService from "../services/branch.service";
import {
  createBranchSchema,
  updateBranchSchema,
  assignStaffBranchSchema,
} from "../validation/branch.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createBranchSchema.parse(req.body);
  const branch = await branchService.createBranch(orgId, input);
  sendSuccess(res, branch, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const branches = await branchService.listBranches(orgId);
  sendSuccess(res, branches);
}

export async function update(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = updateBranchSchema.parse(req.body);
  const branch = await branchService.updateBranch(orgId, req.params.branchId!, input);
  sendSuccess(res, branch);
}

export async function deactivate(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const branch = await branchService.deactivateBranch(orgId, req.params.branchId!);
  sendSuccess(res, branch);
}

export async function assignStaff(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { branchId } = assignStaffBranchSchema.parse(req.body);
  await branchService.assignStaffToBranch(orgId, req.params.userId!, branchId);
  sendSuccess(res, { branchId });
}
