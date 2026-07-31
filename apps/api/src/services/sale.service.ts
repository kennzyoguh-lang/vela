import * as productRepo from "../repositories/product.repository";
import * as saleRepo from "../repositories/sale.repository";
import { NotFoundError } from "../lib/errors";
import type { PageParams } from "../lib/pagination";
import type { CreateSaleInput } from "../validation/sale.schema";

/**
 * Logs a walk-in sale (Anti-theft/POS feature, Piece 1). Price and currency
 * are read server-side from the Product catalog by productId — the request
 * only ever supplies productId + quantity. Trusting anything resembling a
 * client-sent price would defeat "price auto-fills from the catalog" as a
 * real guarantee, not just a UI convenience.
 */
export async function logSale(orgId: string, staffUserId: string, input: CreateSaleInput) {
  const productIds = input.items.map((item) => item.productId);
  const products = await productRepo.findManyByIds(orgId, productIds);
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) throw new NotFoundError("Product not found");
    const unitPrice = Number(product.price);
    return {
      productId: product.id,
      productName: product.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
    };
  });

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const currency = products[0]?.currency ?? "NGN";

  return saleRepo.createSale(orgId, {
    staffUserId,
    total,
    currency,
    customerName: input.customerName,
    items,
  });
}

export async function listSales(orgId: string, page: PageParams) {
  return saleRepo.listByOrg(orgId, page);
}
