import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { ExpenseClaim, ExpenseClaimStatus, TransactionCategory } from "@prisma/client";
import { toPage, type Page, type PageParams } from "../lib/pagination";

export interface CreateExpenseClaimInput {
  submittedByUserId: string;
  category: TransactionCategory;
  vendor: string;
  amount: number;
  currency: string;
  expenseDate: Date;
  description?: string;
  receiptFileId?: string;
}

export async function create(orgId: string, input: CreateExpenseClaimInput): Promise<ExpenseClaim> {
  return withOrgScope(orgId, (tx) =>
    tx.expenseClaim.create({
      data: {
        id: randomUUID(),
        orgId,
        submittedByUserId: input.submittedByUserId,
        category: input.category,
        vendor: input.vendor,
        amount: input.amount,
        currency: input.currency,
        expenseDate: input.expenseDate,
        description: input.description,
        receiptFileId: input.receiptFileId,
      },
    }),
  );
}

export async function findById(orgId: string, claimId: string): Promise<ExpenseClaim | null> {
  return withOrgScope(orgId, (tx) => tx.expenseClaim.findFirst({ where: { id: claimId, orgId } }));
}

export type ExpenseClaimWithSubmitter = ExpenseClaim & { submittedByUser: { name: string } };

// Owner/admin's org-wide view — includes the submitter's name (a plain
// join, not a second query per row) since reviewing someone else's claim
// without knowing whose it is isn't a real review screen.
export async function listAllByOrg(
  orgId: string,
  page: PageParams,
): Promise<Page<ExpenseClaimWithSubmitter>> {
  return withOrgScope(orgId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.expenseClaim.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
        include: { submittedByUser: { select: { name: true } } },
      }),
      tx.expenseClaim.count({ where: { orgId } }),
    ]);
    return toPage(items, total, page);
  });
}

export async function listBySubmitter(
  orgId: string,
  submittedByUserId: string,
  page: PageParams,
): Promise<Page<ExpenseClaim>> {
  return withOrgScope(orgId, async (tx) => {
    const where = { orgId, submittedByUserId };
    const [items, total] = await Promise.all([
      tx.expenseClaim.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
      }),
      tx.expenseClaim.count({ where }),
    ]);
    return toPage(items, total, page);
  });
}

export async function review(
  orgId: string,
  claimId: string,
  status: Extract<ExpenseClaimStatus, "approved" | "rejected">,
  reviewedByUserId: string,
  reviewNote?: string,
): Promise<ExpenseClaim> {
  return withOrgScope(orgId, (tx) =>
    tx.expenseClaim.update({
      where: { id: claimId, orgId },
      data: { status, reviewedByUserId, reviewedAt: new Date(), reviewNote },
    }),
  );
}
