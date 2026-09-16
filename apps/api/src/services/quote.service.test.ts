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

vi.mock("../repositories/quote.repository", () => ({
  createQuote: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  setConvertedInvoiceId: vi.fn(),
}));
vi.mock("../repositories/client.repository", () => ({
  findById: vi.fn(),
}));
vi.mock("../repositories/invoice.repository", () => ({
  createInvoice: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));
vi.mock("./email/email.gateway", () => ({
  sendEmail: vi.fn(),
}));
// Same reasoning as invoice.service.test.ts — lib/env.ts's top-level schema
// parse runs before any beforeAll patching of process.env can take effect.
vi.mock("../lib/env", () => ({
  env: { WEB_APP_URL: "https://app.vela.test" },
}));

import * as quoteRepo from "../repositories/quote.repository";
import * as clientRepo from "../repositories/client.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as emailGateway from "./email/email.gateway";
import * as quoteService from "./quote.service";

describe("quote.service state machine", () => {
  const orgId = randomUUID();
  const quoteId = randomUUID();
  const clientId = randomUUID();

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
      id: quoteId,
      orgId,
      clientId,
      status,
      validUntil: new Date("2026-03-01"),
      convertedInvoiceId: null,
      ...extra,
    };
  }

  const VALID_TRANSITIONS: Array<{ from: string; action: string; to: string }> = [
    { from: "draft", action: "sendQuote", to: "sent" },
    { from: "sent", action: "acceptQuote", to: "accepted" },
    { from: "sent", action: "declineQuote", to: "declined" },
  ];

  for (const { from, action, to } of VALID_TRANSITIONS) {
    it(`allows ${from} -> ${to} via ${action}`, async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(stub(from) as never);
      vi.mocked(quoteRepo.updateStatus).mockResolvedValue(stub(to) as never);

      if (action === "sendQuote") await quoteService.sendQuote(orgId, quoteId);
      if (action === "acceptQuote") await quoteService.acceptQuote(orgId, quoteId);
      if (action === "declineQuote") await quoteService.declineQuote(orgId, quoteId);

      expect(quoteRepo.updateStatus).toHaveBeenCalledWith(orgId, quoteId, to, expect.anything());
    });
  }

  const INVALID_TRANSITIONS: Array<{
    from: string;
    action: "sendQuote" | "acceptQuote" | "declineQuote";
  }> = [
    { from: "accepted", action: "sendQuote" },
    { from: "accepted", action: "acceptQuote" },
    { from: "declined", action: "acceptQuote" },
    { from: "expired", action: "acceptQuote" },
    { from: "draft", action: "acceptQuote" },
    { from: "draft", action: "declineQuote" },
  ];

  for (const { from, action } of INVALID_TRANSITIONS) {
    it(`rejects ${action} from a terminal/invalid "${from}" state`, async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(stub(from) as never);

      const call =
        action === "sendQuote"
          ? quoteService.sendQuote(orgId, quoteId)
          : action === "acceptQuote"
            ? quoteService.acceptQuote(orgId, quoteId)
            : quoteService.declineQuote(orgId, quoteId);

      await expect(call).rejects.toThrow(/Cannot transition quote/);
      expect(quoteRepo.updateStatus).not.toHaveBeenCalled();
    });
  }

  it('markExpired is idempotent - only advances a "sent" quote, never errors otherwise', async () => {
    vi.mocked(quoteRepo.findById).mockResolvedValue(stub("draft") as never);

    const result = await quoteService.markExpired(orgId, quoteId);

    expect(result.status).toBe("draft");
    expect(quoteRepo.updateStatus).not.toHaveBeenCalled();
  });

  describe("sendQuote - actual email delivery", () => {
    function sentQuoteStub() {
      return stub("sent", {
        number: "QUO-0007",
        total: 45_000,
        currency: "NGN",
        portalToken: "token-xyz",
        validUntil: new Date("2026-03-15"),
      });
    }

    it("emails the client when they have an email on file", async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(stub("draft") as never);
      vi.mocked(quoteRepo.updateStatus).mockResolvedValue(sentQuoteStub() as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        name: "Bola Bakery",
        email: "bola@example.com",
      } as never);

      await quoteService.sendQuote(orgId, quoteId);

      expect(emailGateway.sendEmail).toHaveBeenCalledWith(
        "bola@example.com",
        expect.stringContaining("QUO-0007"),
        expect.stringContaining("token-xyz"),
        expect.any(String),
      );
    });

    it("skips the email (but still transitions the status) when the client has no email", async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(stub("draft") as never);
      vi.mocked(quoteRepo.updateStatus).mockResolvedValue(sentQuoteStub() as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        name: "Bola Bakery",
        email: null,
      } as never);

      const result = await quoteService.sendQuote(orgId, quoteId);

      expect(result.status).toBe("sent");
      expect(emailGateway.sendEmail).not.toHaveBeenCalled();
    });

    it("still transitions the status even when the email send throws", async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(stub("draft") as never);
      vi.mocked(quoteRepo.updateStatus).mockResolvedValue(sentQuoteStub() as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        name: "Bola Bakery",
        email: "bola@example.com",
      } as never);
      vi.mocked(emailGateway.sendEmail).mockRejectedValue(new Error("Resend is down"));

      const result = await quoteService.sendQuote(orgId, quoteId);

      expect(result.status).toBe("sent");
    });
  });

  describe("convertToInvoice", () => {
    it("converts an accepted quote, copying its commercial terms verbatim", async () => {
      const acceptedQuote = stub("accepted", {
        number: "QUO-0009",
        lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 100_000 }],
        subtotal: 100_000,
        tax: 0,
        discount: 0,
        total: 100_000,
        currency: "NGN",
        notes: "Thanks for your business",
      });
      vi.mocked(quoteRepo.findById).mockResolvedValue(acceptedQuote as never);
      vi.mocked(clientRepo.findById).mockResolvedValue({
        id: clientId,
        paymentTerms: 14,
      } as never);
      const createdInvoice = { id: randomUUID(), total: 100_000 };
      vi.mocked(invoiceRepo.createInvoice).mockResolvedValue(createdInvoice as never);
      vi.mocked(quoteRepo.setConvertedInvoiceId).mockResolvedValue(acceptedQuote as never);

      const result = await quoteService.convertToInvoice(orgId, quoteId);

      expect(invoiceRepo.createInvoice).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          clientId,
          total: 100_000,
          subtotal: 100_000,
          currency: "NGN",
          notes: "Thanks for your business",
        }),
      );
      expect(quoteRepo.setConvertedInvoiceId).toHaveBeenCalledWith(
        orgId,
        quoteId,
        createdInvoice.id,
      );
      expect(result).toBe(createdInvoice);
    });

    it("rejects converting a quote that isn't accepted", async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(stub("sent") as never);

      await expect(quoteService.convertToInvoice(orgId, quoteId)).rejects.toThrow(
        /Only an accepted quote/,
      );
      expect(invoiceRepo.createInvoice).not.toHaveBeenCalled();
    });

    it("rejects converting a quote that was already converted", async () => {
      vi.mocked(quoteRepo.findById).mockResolvedValue(
        stub("accepted", { convertedInvoiceId: randomUUID() }) as never,
      );

      await expect(quoteService.convertToInvoice(orgId, quoteId)).rejects.toThrow(
        /already been converted/,
      );
      expect(invoiceRepo.createInvoice).not.toHaveBeenCalled();
    });
  });
});
