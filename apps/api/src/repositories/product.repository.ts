import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { Product } from "@prisma/client";

export interface ProductInput {
  name: string;
  price: number;
  currency: string;
  icon: string;
  color: string;
}

export async function create(orgId: string, input: ProductInput): Promise<Product> {
  return withOrgScope(orgId, (tx) =>
    tx.product.create({
      data: {
        id: randomUUID(),
        orgId,
        name: input.name,
        price: input.price,
        currency: input.currency,
        icon: input.icon,
        color: input.color,
      },
    }),
  );
}

export async function findById(orgId: string, productId: string): Promise<Product | null> {
  return withOrgScope(orgId, (tx) => tx.product.findFirst({ where: { id: productId, orgId } }));
}

// Sale logging needs all matching products for a batch of ids in one query
// (sale.service.ts#logSale) — not one findById per line item.
export async function findManyByIds(orgId: string, ids: string[]): Promise<Product[]> {
  return withOrgScope(orgId, (tx) => tx.product.findMany({ where: { orgId, id: { in: ids } } }));
}

export async function listActiveByOrg(orgId: string): Promise<Product[]> {
  return withOrgScope(orgId, (tx) =>
    tx.product.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" } }),
  );
}

export async function update(
  orgId: string,
  productId: string,
  input: Partial<ProductInput>,
): Promise<Product> {
  return withOrgScope(orgId, (tx) =>
    tx.product.update({ where: { id: productId, orgId }, data: input }),
  );
}

// No hard delete, matching the codebase's convention everywhere else.
export async function deactivate(orgId: string, productId: string): Promise<Product> {
  return withOrgScope(orgId, (tx) =>
    tx.product.update({ where: { id: productId, orgId }, data: { isActive: false } }),
  );
}
