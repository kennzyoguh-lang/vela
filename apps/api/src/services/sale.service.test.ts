import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/product.repository", () => ({
  findManyByIds: vi.fn(),
}));
vi.mock("../repositories/sale.repository", () => ({
  createSale: vi.fn(),
  listByOrg: vi.fn(),
}));

import * as productRepo from "../repositories/product.repository";
import * as saleRepo from "../repositories/sale.repository";
import * as saleService from "./sale.service";

describe("sale.service#logSale", () => {
  const orgId = randomUUID();
  const staffUserId = randomUUID();
  const productId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saleRepo.createSale).mockResolvedValue({ id: randomUUID() } as never);
  });

  it("computes the total from the catalog price, ignoring anything resembling a client-sent price", async () => {
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: true },
    ] as never);

    await saleService.logSale(orgId, staffUserId, {
      // @ts-expect-error deliberately probing a client-sent price the schema
      // doesn't even define a field for — the service must never read it.
      items: [{ productId, quantity: 3, price: 1 }],
    });

    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({
        staffUserId,
        total: 4500, // 1500 * 3, the catalog price — never the smuggled price: 1
        currency: "NGN",
        items: [
          expect.objectContaining({
            productId,
            productName: "Phone case",
            unitPrice: 1500,
            quantity: 3,
            lineTotal: 4500,
          }),
        ],
      }),
    );
  });

  it("rejects an unknown product id", async () => {
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([]);

    await expect(
      saleService.logSale(orgId, staffUserId, { items: [{ productId, quantity: 1 }] }),
    ).rejects.toThrow(/not found/i);
    expect(saleRepo.createSale).not.toHaveBeenCalled();
  });

  it("rejects a deactivated product", async () => {
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: false },
    ] as never);

    await expect(
      saleService.logSale(orgId, staffUserId, { items: [{ productId, quantity: 1 }] }),
    ).rejects.toThrow(/not found/i);
  });

  it("sums multiple line items into one total", async () => {
    const productId2 = randomUUID();
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: true },
      { id: productId2, name: "Charger", price: 3000, currency: "NGN", isActive: true },
    ] as never);

    await saleService.logSale(orgId, staffUserId, {
      items: [
        { productId, quantity: 2 },
        { productId: productId2, quantity: 1 },
      ],
    });

    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ total: 6000 }), // (1500*2) + (3000*1)
    );
  });
});
