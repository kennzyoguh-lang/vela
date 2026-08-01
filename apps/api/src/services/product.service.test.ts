import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/product.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listActiveByOrg: vi.fn(),
  listLowStockByOrg: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
}));

import * as productRepo from "../repositories/product.repository";
import * as productService from "./product.service";

describe("product.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a product by delegating straight to the repository", async () => {
    const input = {
      name: "Phone case",
      price: 1500,
      currency: "NGN",
      icon: "smartphone",
      color: "blue",
    };
    vi.mocked(productRepo.create).mockResolvedValue({ id: randomUUID(), ...input } as never);

    await productService.createProduct(orgId, input);

    expect(productRepo.create).toHaveBeenCalledWith(orgId, input);
  });

  it("throws NotFoundError for an unknown product id", async () => {
    vi.mocked(productRepo.findById).mockResolvedValue(null);

    await expect(productService.getProduct(orgId, randomUUID())).rejects.toThrow(/not found/i);
  });

  it("404s before attempting an update on a missing product", async () => {
    vi.mocked(productRepo.findById).mockResolvedValue(null);

    await expect(
      productService.updateProduct(orgId, randomUUID(), { price: 2000 }),
    ).rejects.toThrow(/not found/i);
    expect(productRepo.update).not.toHaveBeenCalled();
  });

  it("lists low-stock products by delegating to the repository", async () => {
    const lowStockProducts = [{ id: randomUUID(), name: "USB Cable", stockQuantity: 1 }];
    vi.mocked(productRepo.listLowStockByOrg).mockResolvedValue(lowStockProducts as never);

    const result = await productService.listLowStockProducts(orgId);

    expect(productRepo.listLowStockByOrg).toHaveBeenCalledWith(orgId);
    expect(result).toBe(lowStockProducts);
  });

  it("deactivates an existing product", async () => {
    const productId = randomUUID();
    vi.mocked(productRepo.findById).mockResolvedValue({ id: productId } as never);
    vi.mocked(productRepo.deactivate).mockResolvedValue({
      id: productId,
      isActive: false,
    } as never);

    await productService.deactivateProduct(orgId, productId);

    expect(productRepo.deactivate).toHaveBeenCalledWith(orgId, productId);
  });
});
