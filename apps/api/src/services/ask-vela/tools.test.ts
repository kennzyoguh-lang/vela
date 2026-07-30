import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/invoice.repository", () => ({
  listAllByOrg: vi.fn(),
}));
vi.mock("../../repositories/bank-account.repository", () => ({
  listActiveByOrg: vi.fn(),
}));
vi.mock("../compliance.service", () => ({
  listFilings: vi.fn(),
  listObligations: vi.fn(),
}));
vi.mock("../pnl.service", () => ({
  getPnlStatement: vi.fn(),
}));
vi.mock("../payroll.service", () => ({
  listRuns: vi.fn(),
}));

import * as invoiceRepo from "../../repositories/invoice.repository";
import * as bankAccountRepo from "../../repositories/bank-account.repository";
import * as complianceService from "../compliance.service";
import * as pnlService from "../pnl.service";
import * as payrollService from "../payroll.service";
import { getToolByName } from "./tools";

describe("ask-vela tools", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("get_outstanding_invoices", () => {
    it("filters to the default outstanding statuses when no status is given", async () => {
      vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([
        {
          id: "1",
          number: "INV-0001",
          status: "overdue",
          total: 1000,
          currency: "NGN",
          dueDate: new Date(),
        },
        {
          id: "2",
          number: "INV-0002",
          status: "paid",
          total: 500,
          currency: "NGN",
          dueDate: new Date(),
        },
        {
          id: "3",
          number: "INV-0003",
          status: "sent",
          total: 250,
          currency: "NGN",
          dueDate: new Date(),
        },
      ] as never);

      const tool = getToolByName("get_outstanding_invoices")!;
      const result = await tool.execute(orgId, {});

      expect(invoiceRepo.listAllByOrg).toHaveBeenCalledWith(orgId);
      const data = result.data as { count: number; total: number };
      expect(data.count).toBe(2);
      expect(data.total).toBe(1250);
      expect(result.citations).toHaveLength(2);
    });

    it("narrows to a single status when provided, calling listAllByOrg with that filter", async () => {
      vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([
        {
          id: "1",
          number: "INV-0001",
          status: "paid",
          total: 500,
          currency: "NGN",
          dueDate: new Date(),
        },
      ] as never);

      const tool = getToolByName("get_outstanding_invoices")!;
      await tool.execute(orgId, { status: "paid" });

      expect(invoiceRepo.listAllByOrg).toHaveBeenCalledWith(orgId, { status: "paid" });
    });

    it("only ever uses the orgId passed by the caller, never one smuggled in via tool input", async () => {
      vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([]);
      const tool = getToolByName("get_outstanding_invoices")!;
      const foreignOrgId = randomUUID();

      // Deliberately probing with an org id inside the input payload, which
      // the zod schema doesn't even define a field for — execute() takes
      // `unknown`, so this is a runtime-only check, not a type-level one.
      await tool.execute(orgId, { orgId: foreignOrgId, status: undefined });

      expect(invoiceRepo.listAllByOrg).toHaveBeenCalledWith(orgId);
      expect(invoiceRepo.listAllByOrg).not.toHaveBeenCalledWith(foreignOrgId);
    });
  });

  describe("get_compliance_status", () => {
    it("attaches the obligation label and only cites unfiled filings", async () => {
      vi.mocked(complianceService.listFilings).mockResolvedValue([
        {
          id: "f1",
          obligationType: "vat",
          periodLabel: "2026-07",
          dueDate: new Date(),
          status: "overdue",
        },
        {
          id: "f2",
          obligationType: "paye",
          periodLabel: "2026-07",
          dueDate: new Date(),
          status: "filed",
        },
      ] as never);
      vi.mocked(complianceService.listObligations).mockResolvedValue([
        { type: "vat", label: "VAT return" },
        { type: "paye", label: "PAYE remittance" },
      ] as never);

      const tool = getToolByName("get_compliance_status")!;
      const result = await tool.execute(orgId, {});

      const data = result.data as { filings: Array<{ label: string }> };
      expect(data.filings[0]!.label).toBe("VAT return");
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0]!.label).toContain("VAT return");
    });
  });

  describe("get_pnl_summary", () => {
    it("passes parsed Date objects to getPnlStatement and returns one citation for the range", async () => {
      vi.mocked(pnlService.getPnlStatement).mockResolvedValue({
        income: 100,
        expensesByCategory: {},
        totalExpenses: 0,
        netProfit: 100,
      });

      const tool = getToolByName("get_pnl_summary")!;
      const result = await tool.execute(orgId, { from: "2026-01-01", to: "2026-01-31" });

      expect(pnlService.getPnlStatement).toHaveBeenCalledWith(
        orgId,
        new Date("2026-01-01"),
        new Date("2026-01-31"),
      );
      expect(result.citations).toHaveLength(1);
    });

    it("rejects a malformed date", async () => {
      const tool = getToolByName("get_pnl_summary")!;
      await expect(tool.execute(orgId, { from: "not-a-date", to: "2026-01-31" })).rejects.toThrow();
    });
  });

  describe("get_cash_position", () => {
    it("sums current balances across active accounts and cites each one", async () => {
      vi.mocked(bankAccountRepo.listActiveByOrg).mockResolvedValue([
        {
          id: "a1",
          institutionName: "GTBank",
          accountType: "current",
          currentBalance: 1000,
          currency: "NGN",
        },
        {
          id: "a2",
          institutionName: "Access Bank",
          accountType: "savings",
          currentBalance: 2000,
          currency: "NGN",
        },
      ] as never);

      const tool = getToolByName("get_cash_position")!;
      const result = await tool.execute(orgId, {});

      const data = result.data as { total: number };
      expect(data.total).toBe(3000);
      expect(result.citations).toHaveLength(2);
    });
  });

  describe("get_payroll_status", () => {
    it("never includes individual employee names or payslip detail", async () => {
      vi.mocked(payrollService.listRuns).mockResolvedValue([
        {
          id: "r1",
          periodLabel: "2026-07",
          status: "paid",
          totalGrossPay: 500000,
          totalDeductions: 50000,
          totalNetPay: 450000,
        },
      ] as never);

      const tool = getToolByName("get_payroll_status")!;
      const result = await tool.execute(orgId, {});

      const serialized = JSON.stringify(result.data);
      expect(serialized).not.toContain("employee");
      expect(serialized).not.toContain("payslip");
    });

    it("filters to the requested period only", async () => {
      vi.mocked(payrollService.listRuns).mockResolvedValue([
        {
          id: "r1",
          periodLabel: "2026-06",
          status: "paid",
          totalGrossPay: 1,
          totalDeductions: 0,
          totalNetPay: 1,
        },
        {
          id: "r2",
          periodLabel: "2026-07",
          status: "draft",
          totalGrossPay: 2,
          totalDeductions: 0,
          totalNetPay: 2,
        },
      ] as never);

      const tool = getToolByName("get_payroll_status")!;
      const result = await tool.execute(orgId, { periodLabel: "2026-07" });

      const data = result.data as { runs: Array<{ periodLabel: string }> };
      expect(data.runs).toHaveLength(1);
      expect(data.runs[0]!.periodLabel).toBe("2026-07");
    });
  });
});
