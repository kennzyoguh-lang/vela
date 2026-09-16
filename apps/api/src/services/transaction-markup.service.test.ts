import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/transaction-markup.repository", () => ({
  create: vi.fn(),
}));
vi.mock("../repositories/payment-activation.repository", () => ({
  recordPayment: vi.fn(),
}));

import * as transactionMarkupRepo from "../repositories/transaction-markup.repository";
import * as paymentActivationRepo from "../repositories/payment-activation.repository";
import { recordMarkup, DEFAULT_MARKUP_PCT, MARKUP_CAP_AMOUNT } from "./transaction-markup.service";

describe("transaction-markup.service — fee cap", () => {
  const orgId = randomUUID();
  const invoiceId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionMarkupRepo.create).mockResolvedValue({ id: randomUUID() } as never);
  });

  function baseInput(grossAmount: number) {
    return {
      orgId,
      invoiceId,
      processor: "paystack" as const,
      grossAmount,
      processorFee: 0,
      currency: "NGN",
      settledAt: new Date(),
      activationChannel: "portal",
    };
  }

  it("charges the plain 0.5% for a transaction well under the cap threshold", async () => {
    await recordMarkup(baseInput(10_000)); // 0.5% = 50, cap is 2000 — uncapped

    expect(transactionMarkupRepo.create).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ velaFeeAmount: 50, velaMarkupPct: DEFAULT_MARKUP_PCT }),
    );
  });

  it("caps the fee for a large transaction instead of letting it grow unbounded", async () => {
    // 0.5% of 500,000 would be 2,500 — above the 2,000 cap.
    await recordMarkup(baseInput(500_000));

    expect(transactionMarkupRepo.create).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ velaFeeAmount: MARKUP_CAP_AMOUNT }),
    );
  });

  it("charges exactly the cap at the breakeven point, not a cent more", async () => {
    // 0.5% of 400,000 is exactly 2,000 — right at the cap boundary.
    await recordMarkup(baseInput(400_000));

    expect(transactionMarkupRepo.create).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ velaFeeAmount: MARKUP_CAP_AMOUNT }),
    );
  });

  it("still records payment activation volume using the gross amount, not the capped fee", async () => {
    await recordMarkup(baseInput(500_000));

    expect(paymentActivationRepo.recordPayment).toHaveBeenCalledWith(orgId, "portal", 500_000);
  });
});
