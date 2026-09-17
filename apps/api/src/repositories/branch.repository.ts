import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { Branch } from "@prisma/client";

export interface BranchInput {
  name: string;
  address?: string;
}

export async function create(orgId: string, input: BranchInput): Promise<Branch> {
  return withOrgScope(orgId, (tx) =>
    tx.branch.create({
      data: { id: randomUUID(), orgId, name: input.name, address: input.address },
    }),
  );
}

export async function findById(orgId: string, branchId: string): Promise<Branch | null> {
  return withOrgScope(orgId, (tx) => tx.branch.findFirst({ where: { id: branchId, orgId } }));
}

export async function listActiveByOrg(orgId: string): Promise<Branch[]> {
  return withOrgScope(orgId, (tx) =>
    tx.branch.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" } }),
  );
}

export async function update(
  orgId: string,
  branchId: string,
  input: Partial<BranchInput>,
): Promise<Branch> {
  return withOrgScope(orgId, (tx) =>
    tx.branch.update({ where: { id: branchId, orgId }, data: input }),
  );
}

// No hard delete, matching product.repository.ts's convention — a
// deactivated branch's own history (Sale/CashReconciliation/User rows that
// reference it) must stay intact.
export async function deactivate(orgId: string, branchId: string): Promise<Branch> {
  return withOrgScope(orgId, (tx) =>
    tx.branch.update({ where: { id: branchId, orgId }, data: { isActive: false } }),
  );
}

// Assigns (or, with null, unassigns) a staff member to a branch. Lives here
// rather than user.repository.ts since it's branch-management's own write
// path (branch.routes.ts), not a general user-profile update.
export async function assignStaff(
  orgId: string,
  userId: string,
  branchId: string | null,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { branchId } }),
  );
}
