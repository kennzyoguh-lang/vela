import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= "placeholder";
});

vi.mock("../repositories/invoice.repository", () => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
}));
vi.mock("../repositories/client.repository", () => ({
  findById: vi.fn(),
  updateAvgPaymentDays: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));
vi.mock("./email/email.gateway", () => ({
  sendEmail: vi.fn(),
}));
// beforeAll's process.env patching below runs too late to satisfy this —
// module-level imports (and lib/env.ts's top-level schema parse) evaluate
// before any test lifecycle hook does. Same convention as
// quick-sale.service.test.ts for the same reason.
vi.mock("../lib/env", () => ({
  env: { WEB_APP_URL: "https://app.vela.test" },
}));

import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as emailGateway from "./email/email.gateway";
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
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      name: "Acme Traders",
    } as never);
    vi.mocked(emailGateway.sendEmail).mockResolvedValue(undefined);
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

  describe("sendInvoice — F-02's actual email delivery", () => {
    function sentInvoiceStub() {
      return stub("sent", {
        number: "INV-0042",
        total: 75_000,
        currency: "NGN",
        paymentPortalToken: "token-xyz",
        dueDate: new Date("2026-02-01"),
      });
    }

    it("emails the client when they have an email on file", async () => {
      vi.mocked(invoiceRepo.findById).mockResolvedValue(stub("draft") as never);
      vi.mocked(invoiceRepo.updateStatus).mockResolvedValue(sentInvoiceStub() as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        name: "Bola's Bakery",
        email: "bola@example.com",
      } as never);

      await invoiceService.sendInvoice(orgId, invoiceId);

      expect(emailGateway.sendEmail).toHaveBeenCalledWith(
        "bola@example.com",
        expect.stringContaining("INV-0042"),
        expect.stringContaining("token-xyz"),
        expect.any(String),
      );
    });

    it("skips the email (but still transitions the status) when the client has no email", async () => {
      vi.mocked(invoiceRepo.findById).mockResolvedValue(stub("draft") as never);
      vi.mocked(invoiceRepo.updateStatus).mockResolvedValue(sentInvoiceStub() as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        name: "Bola's Bakery",
        email: null,
      } as never);

      const result = await invoiceService.sendInvoice(orgId, invoiceId);

      expect(result.status).toBe("sent");
      expect(emailGateway.sendEmail).not.toHaveBeenCalled();
    });

    it("still transitions the status even when the email send throws", async () => {
      vi.mocked(invoiceRepo.findById).mockResolvedValue(stub("draft") as never);
      vi.mocked(invoiceRepo.updateStatus).mockResolvedValue(sentInvoiceStub() as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        name: "Bola's Bakery",
        email: "bola@example.com",
      } as never);
      vi.mocked(emailGateway.sendEmail).mockRejectedValue(new Error("Resend is down"));

      const result = await invoiceService.sendInvoice(orgId, invoiceId);

      expect(result.status).toBe("sent");
    });
  });
});
