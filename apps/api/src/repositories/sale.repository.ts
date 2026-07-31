import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import { toPage, type Page, type PageParams } from "../lib/pagination";
import type { Sale, SaleItem } from "@prisma/client";

export interface SaleItemInput {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CreateSaleData {
  staffUserId: string;
  total: number;
  discountAmount: number;
  currency: string;
  customerName?: string;
  items: SaleItemInput[];
}

export type SaleWithItems = Sale & { items: SaleItem[] };

export async function createSale(orgId: string, input: CreateSaleData): Promise<SaleWithItems> {
  return withOrgScope(orgId, (tx) =>
    tx.sale.create({
      data: {
        id: randomUUID(),
        orgId,
        staffUserId: input.staffUserId,
        total: input.total,
        discountAmount: input.discountAmount,
        currency: input.currency,
        customerName: input.customerName,
        items: {
          create: input.items.map((item) => ({
            id: randomUUID(),
            orgId,
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: { items: true },
    }),
  );
}

// Piece 3's owner daily summary — count + total in one query. Voided sales
// are excluded by construction (status is part of the where clause), same
// reasoning as cash-check.repository.ts's sumCompletedSalesTotal.
export async function getDailyStats(
  orgId: string,
  start: Date,
  end: Date,
): Promise<{ count: number; total: number }> {
  return withOrgScope(orgId, async (tx) => {
    const result = await tx.sale.aggregate({
      where: { orgId, status: "completed", soldAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { total: true },
    });
    return { count: result._count._all, total: Number(result._sum.total ?? 0) };
  });
}

// Piece 2's "today's sales" view — paginated for a human, unlike a future
// cash-reconciliation total which would need every row (not built yet).
export async function listByOrg(orgId: string, page: PageParams): Promise<Page<SaleWithItems>> {
  return withOrgScope(orgId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.sale.findMany({
        where: { orgId },
        orderBy: { soldAt: "desc" },
        skip: page.skip,
        take: page.take,
        include: { items: true },
      }),
      tx.sale.count({ where: { orgId } }),
    ]);
    return toPage(items, total, page);
  });
}
