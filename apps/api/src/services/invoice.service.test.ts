import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
});

vi.mock("../repositories/invoice.repository", () => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
}));
vi.mock("../repositories/client.repository", () => ({
  findById: vi.fn(),
  updateAvgPaymentDays: vi.fn(),
}));

import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import * as invoiceService from "./invoice.service";

// Handbook 16.1's explicit state machine — every valid transition asserted to
// go through, every invalid one rejected with BUSINESS_RULE_VIOLATION. Terminal
// states (paid, written_off, void) must reject every transition attempt.
describe("invoice.service state machine", () => {
  const orgId = randomUUID();
  const invoiceId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientRepo.findById).mockResolvedValue(null);
  });

  function stub(status: string, extra: Record<string, unknown> = {}) {
    return {
      id: invoiceId,
      orgId,
      status,
      dueDate: new Date("2026-01-01"),
      clientId: randomUUID(),
      ...extra,
    };
  }

  const VALID_TRANSITIONS: Array<{ from: string; action: string; to: string }> = [
    { from: "draft", action: "sendInvoice", to: "sent" },
    { from: "draft", action: "voidInvoice", to: "void" },
    { from: "sent", action: "markPaid", to: "paid" },
    { from: "sent", action: "voidInvoice", to: "void" },
    { from: "viewed", action: "markPaid", to: "paid" },
    { from: "overdue", action: "markPaid", to: "paid" },
    { from: "overdue", action: "voidInvoice", to: "void" },
  ];

  for (const { from, action, to } of VALID_TRANSITIONS) {
    it(`allows ${from} -> ${to} via ${action}`, async () => {
      vi.mocked(invoiceRepo.findById).mockResolvedValue(stub(from) as never);
      vi.mocked(invoiceRepo.updateStatus).mockResolvedValue(
        stub(to, { paidAt: new Date() }) as never,
      );

      if (action === "sendInvoice") await invoiceService.sendInvoice(orgId, invoiceId);
      if (action === "markPaid") await invoiceService.markPaid(orgId, invoiceId);
      if (action === "voidInvoice")
        await invoiceService.voidInvoice(orgId, invoiceId, "test reason");

      expect(invoiceRepo.updateStatus).toHaveBeenCalledWith(
        orgId,
        invoiceId,
        to,
        expect.anything(),
      );
    });
  }

  const INVALID_TRANSITIONS: Array<{
    from: string;
    action: "sendInvoice" | "markPaid" | "voidInvoice";
  }> = [
    { from: "paid", action: "sendInvoice" },
    { from: "paid", action: "markPaid" },
    { from: "paid", action: "voidInvoice" },
    { from: "void", action: "markPaid" },
    { from: "written_off", action: "markPaid" },
    { from: "draft", action: "markPaid" },
    { from: "partially_paid", action: "sendInvoice" },
  ];

  for (const { from, action } of INVALID_TRANSITIONS) {
    it(`rejects ${action} from a terminal/invalid "${from}" state`, async () => {
      vi.mocked(invoiceRepo.findById).mockResolvedValue(stub(from) as never);

      const call =
        action === "sendInvoice"
          ? invoiceService.sendInvoice(orgId, invoiceId)
          : action === "markPaid"
            ? invoiceService.markPaid(orgId, invoiceId)
            : invoiceService.voidInvoice(orgId, invoiceId, "test reason");

      await expect(call).rejects.toThrow(/Cannot transition invoice/);
      expect(invoiceRepo.updateStatus).not.toHaveBeenCalled();
    });
  }

  it('markViewed is idempotent — only advances a "sent" invoice, never errors otherwise', async () => {
    vi.mocked(invoiceRepo.findById).mockResolvedValue(stub("viewed") as never);

    const result = await invoiceService.markViewed(orgId, invoiceId);

    expect(result.status).toBe("viewed");
    expect(invoiceRepo.updateStatus).not.toHaveBeenCalled();
  });
});
