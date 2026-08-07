import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/calculator-lead.repository", () => ({
  createLead: vi.fn(),
  markConverted: vi.fn(),
}));

import * as calculatorLeadRepo from "../repositories/calculator-lead.repository";
import * as calculatorLeadService from "./calculator-lead.service";

describe("calculator-lead.service#recordLead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recomputes penalty totals server-side and persists them, never trusting a client total", async () => {
    await calculatorLeadService.recordLead({
      email: "trader@example.com",
      businessName: "Ada's Textiles",
      lastVatFiledAt: null,
      monthlyVat: 0,
      lastWhtRemittedAt: null,
      monthlyWht: 0,
      citLastFiledYear: null,
      monthlyCit: 0,
    });

    expect(calculatorLeadRepo.createLead).toHaveBeenCalledWith({
      email: "trader@example.com",
      businessName: "Ada's Textiles",
      vatPenalty: 0,
      whtPenalty: 0,
      citPenalty: 0,
      totalPenalty: 0,
    });
  });

  it("passes through a nonzero computed total for a genuinely overdue input", async () => {
    await calculatorLeadService.recordLead({
      email: "trader@example.com",
      businessName: "Ada's Textiles",
      lastVatFiledAt: "2020-01-01T00:00:00Z",
      monthlyVat: 200_000,
      lastWhtRemittedAt: null,
      monthlyWht: 0,
      citLastFiledYear: null,
      monthlyCit: 0,
    });

    const call = vi.mocked(calculatorLeadRepo.createLead).mock.calls[0]?.[0];
    expect(call?.vatPenalty).toBeGreaterThan(0);
    expect(call?.totalPenalty).toBe(call?.vatPenalty);
  });
});

describe("calculator-lead.service#markConverted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates straight to the repository", async () => {
    await calculatorLeadService.markConverted("trader@example.com");
    expect(calculatorLeadRepo.markConverted).toHaveBeenCalledWith("trader@example.com");
  });
});
