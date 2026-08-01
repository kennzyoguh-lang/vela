import * as productRepo from "../repositories/product.repository";
import { NotFoundError } from "../lib/errors";
import type { ProductInput } from "../repositories/product.repository";

export async function createProduct(orgId: string, input: ProductInput) {
  return productRepo.create(orgId, input);
}

export async function getProduct(orgId: string, productId: string) {
  const product = await productRepo.findById(orgId, productId);
  if (!product) throw new NotFoundError("Product not found");
  return product;
}

export async function listProducts(orgId: string) {
  return productRepo.listActiveByOrg(orgId);
}

// Low-stock alerts (value-add follow-up) — the dashboard widget's data
// source; owner/admin reporting surface, same tier as sale/cash-check
// history views elsewhere in this codebase.
export async function listLowStockProducts(orgId: string) {
  return productRepo.listLowStockByOrg(orgId);
}

export async function updateProduct(
  orgId: string,
  productId: string,
  input: Partial<ProductInput>,
) {
  await getProduct(orgId, productId); // 404s before attempting the update
  return productRepo.update(orgId, productId, input);
}

export async function deactivateProduct(orgId: string, productId: string) {
  await getProduct(orgId, productId);
  return productRepo.deactivate(orgId, productId);
}
