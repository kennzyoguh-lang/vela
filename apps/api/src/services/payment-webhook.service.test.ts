import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/invoice.repository", () => ({
  findByPaymentPortalToken: vi.fn(),
}));
vi.mock("./invoice.service", () => ({
  markPaid: vi.fn(),
}));
vi.mock("./transaction-markup.service", () => ({
  recordMarkup: vi.fn(),
}));
vi.mock("../repositories/webhook-event.repository", () => ({
  recordIfNew: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./payment-gateways", () => ({
  getGateway: vi.fn(),
}));

import * as invoiceRepo from "../repositories/invoice.repository";
import * as invoiceService from "./invoice.service";
import * as transactionMarkupService from "./transaction-markup.service";
import * as webhookEventRepo from "../repositories/webhook-event.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { getGateway } from "./payment-gateways";
import { processWebhook } from "./payment-webhook.service";

function stubGateway(overrides: Record<string, unknown> = {}) {
  return {
    processor: "paystack",
    initializePayment: vi.fn(),
    verifyWebhookSignature: vi.fn(() => true),
    parseWebhookEvent: vi.fn(() => ({
      eventId: "evt_1",
      reference: "portal-token-1",
      status: "success",
      grossAmount: 5000,
      currency: "NGN",
      processorFee: 75,
      paidAt: new Date(),
    })),
    ...overrides,
  };
}

describe("payment-webhook.service — idempotency and signature verification", () => {
  const orgId = randomUUID();
  const invoiceId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(webhookEventRepo.recordIfNew).mockResolvedValue(true);
    vi.mocked(invoiceRepo.findByPaymentPortalToken).mockResolvedValue({
      orgId,
      id: invoiceId,
    } as never);
  });

  it("rejects a webhook with an invalid signature before touching any invoice", async () => {
    vi.mocked(getGateway).mockReturnValue(
      stubGateway({ verifyWebhookSignature: () => false }) as never,
    );

    const outcome = await processWebhook("paystack", Buffer.from("{}"), "bad-sig");

    expect(outcome).toBe("invalid_signature");
    expect(webhookEventRepo.recordIfNew).not.toHaveBeenCalled();
    expect(invoiceService.markPaid).not.toHaveBeenCalled();
  });

  it("processes a new event exactly once: marks paid, records markup, audit-logs", async () => {
    vi.mocked(getGateway).mockReturnValue(stubGateway() as never);

    const outcome = await processWebhook("paystack", Buffer.from("{}"), "sig");

    expect(outcome).toBe("processed");
    expect(invoiceService.markPaid).toHaveBeenCalledWith(orgId, invoiceId);
    expect(transactionMarkupService.recordMarkup).toHaveBeenCalledTimes(1);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ orgId, entityId: invoiceId, action: "invoice.mark_paid" }),
    );
  });

  it("a duplicate delivery of the same event is a no-op — never double-marks paid", async () => {
    vi.mocked(getGateway).mockReturnValue(stubGateway() as never);
    // Simulates the DB unique-constraint guard reporting "already seen" —
    // the real guarantee under concurrent delivery is the
    // @@unique([processor, providerEventId]) constraint itself, not this
    // mock, but the service must still short-circuit correctly on it.
    vi.mocked(webhookEventRepo.recordIfNew).mockResolvedValue(false);

    const outcome = await processWebhook("paystack", Buffer.from("{}"), "sig");

    expect(outcome).toBe("duplicate");
    expect(invoiceService.markPaid).not.toHaveBeenCalled();
    expect(transactionMarkupService.recordMarkup).not.toHaveBeenCalled();
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });

  it("an event type the handler doesn't act on is ignored, not processed", async () => {
    vi.mocked(getGateway).mockReturnValue(stubGateway({ parseWebhookEvent: () => null }) as never);

    const outcome = await processWebhook("paystack", Buffer.from("{}"), "sig");

    expect(outcome).toBe("ignored");
    expect(webhookEventRepo.recordIfNew).not.toHaveBeenCalled();
  });

  it("a webhook referencing an invoice that doesn't exist is reported, not silently dropped", async () => {
    vi.mocked(getGateway).mockReturnValue(stubGateway() as never);
    vi.mocked(invoiceRepo.findByPaymentPortalToken).mockResolvedValue(null);

    const outcome = await processWebhook("paystack", Buffer.from("{}"), "sig");

    expect(outcome).toBe("unknown_invoice");
    expect(invoiceService.markPaid).not.toHaveBeenCalled();
  });
});
