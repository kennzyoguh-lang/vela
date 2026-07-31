import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/invoice.repository", () => ({
  createInvoice: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));

import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as quickSaleService from "./quick-sale.service";

describe("quick-sale.service#createQuickSale", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoiceRepo.createInvoice).mockResolvedValue({ id: randomUUID() } as never);
  });

  it("creates an Invoice with no client, source quick_sale, and status already sent", async () => {
    await quickSaleService.createQuickSale(orgId, actorId, { amount: 5000, currency: "NGN" });

    expect(invoiceRepo.createInvoice).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({
        clientId: null,
        source: "quick_sale",
        status: "sent",
        subtotal: 5000,
        total: 5000,
        tax: 0,
        discount: 0,
        currency: "NGN",
        lineItems: [{ description: "Quick Sale", quantity: 1, unitPrice: 5000 }],
      }),
    );
  });

  it("audit-logs the creation", async () => {
    const createdId = randomUUID();
    vi.mocked(invoiceRepo.createInvoice).mockResolvedValue({ id: createdId } as never);

    await quickSaleService.createQuickSale(orgId, actorId, { amount: 2500, currency: "NGN" });

    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "quick_sale.created",
        entityType: "invoice",
        entityId: createdId,
        newValue: { amount: 2500, currency: "NGN" },
      }),
    );
  });
});
