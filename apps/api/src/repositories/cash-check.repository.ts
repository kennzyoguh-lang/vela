import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import { toPage, type Page, type PageParams } from "../lib/pagination";
import type { CashReconciliation } from "@prisma/client";

export interface CreateCashCheckData {
  staffUserId: string;
  businessDate: Date;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
  matched: boolean;
  currency: string;
}

// Voided sales are excluded by construction — status: "completed" is part of
// the where clause, not a post-filter — so a theft cover-up via voiding a
// sale after the fact wouldn't also shrink the expected-cash figure.
export async function sumCompletedSalesTotal(
  orgId: string,
  start: Date,
  end: Date,
): Promise<number> {
  return withOrgScope(orgId, async (tx) => {
    const result = await tx.sale.aggregate({
      where: { orgId, status: "completed", soldAt: { gte: start, lt: end } },
      _sum: { total: true },
    });
    return Number(result._sum.total ?? 0);
  });
}

export async function create(
  orgId: string,
  input: CreateCashCheckData,
): Promise<CashReconciliation> {
  return withOrgScope(orgId, (tx) =>
    tx.cashReconciliation.create({
      data: {
        id: randomUUID(),
        orgId,
        staffUserId: input.staffUserId,
        businessDate: input.businessDate,
        expectedAmount: input.expectedAmount,
        countedAmount: input.countedAmount,
        difference: input.difference,
        matched: input.matched,
        currency: input.currency,
      },
    }),
  );
}

export async function listByOrg(
  orgId: string,
  page: PageParams,
): Promise<Page<CashReconciliation>> {
  return withOrgScope(orgId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.cashReconciliation.findMany({
        where: { orgId },
        orderBy: { businessDate: "desc" },
        skip: page.skip,
        take: page.take,
      }),
      tx.cashReconciliation.count({ where: { orgId } }),
    ]);
    return toPage(items, total, page);
  });
}
