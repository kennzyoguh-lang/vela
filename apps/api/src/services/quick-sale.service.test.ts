import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/invoice.repository", () => ({
  createInvoice: vi.fn(),
  findById: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
// Avoids pulling in lib/env.ts's full schema parse (DATABASE_URL, JWT keys,
// etc.) just for this file's one read of WEB_APP_URL — those other vars are
// irrelevant to this domain service and unrelated to what's under test here.
vi.mock("../lib/env", () => ({
  env: { WEB_APP_URL: "https://app.vela.test" },
}));
vi.mock("./sms/termii.gateway", () => ({
  sendSms: vi.fn(),
}));

import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as smsGateway from "./sms/termii.gateway";
import { NotFoundError } from "../lib/errors";
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

describe("quick-sale.service#sendPaymentLinkSms", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();
  const invoiceId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoiceRepo.findById).mockResolvedValue({
      id: invoiceId,
      total: "3200",
      paymentPortalToken: "abc-token",
    } as never);
    vi.mocked(smsGateway.sendSms).mockResolvedValue(undefined);
  });

  it("normalizes the phone, composes a 'Pay ₦X now' message with the real link, sends it, and returns sent: true", async () => {
    const result = await quickSaleService.sendPaymentLinkSms(orgId, actorId, invoiceId, {
      phone: "08012345678",
      channel: "sms",
    });

    expect(result.sent).toBe(true);
    expect(result.message).toContain("Pay ₦3,200 now:");
    expect(result.message).toContain("/pay/abc-token");
    expect(smsGateway.sendSms).toHaveBeenCalledWith("+2348012345678", result.message, "generic");
  });

  it("sends via the whatsapp channel when requested", async () => {
    await quickSaleService.sendPaymentLinkSms(orgId, actorId, invoiceId, {
      phone: "08012345678",
      channel: "whatsapp",
    });

    expect(smsGateway.sendSms).toHaveBeenCalledWith(
      "+2348012345678",
      expect.any(String),
      "whatsapp",
    );
  });

  it("propagates a real send failure to the caller instead of swallowing it", async () => {
    vi.mocked(smsGateway.sendSms).mockRejectedValue(
      new Error("Termii SMS send failed: bad number"),
    );

    await expect(
      quickSaleService.sendPaymentLinkSms(orgId, actorId, invoiceId, {
        phone: "08012345678",
        channel: "sms",
      }),
    ).rejects.toThrow(/Termii SMS send failed/);
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });

  it("audit-logs the send with the normalized phone and channel", async () => {
    await quickSaleService.sendPaymentLinkSms(orgId, actorId, invoiceId, {
      phone: "08012345678",
      channel: "sms",
    });

    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "quick_sale.sms_sent",
        entityType: "invoice",
        entityId: invoiceId,
        newValue: { phone: "+2348012345678", channel: "sms" },
      }),
    );
  });

  it("throws NotFoundError when the invoice doesn't exist in this org", async () => {
    vi.mocked(invoiceRepo.findById).mockResolvedValue(null);

    await expect(
      quickSaleService.sendPaymentLinkSms(orgId, actorId, invoiceId, {
        phone: "08012345678",
        channel: "sms",
      }),
    ).rejects.toThrow(NotFoundError);
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number before any audit log is written", async () => {
    await expect(
      quickSaleService.sendPaymentLinkSms(orgId, actorId, invoiceId, {
        phone: "123",
        channel: "sms",
      }),
    ).rejects.toThrow();
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });
});
