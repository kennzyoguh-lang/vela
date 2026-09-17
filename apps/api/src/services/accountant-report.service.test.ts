import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/accountant-link.repository", () => ({
  listAllActiveLinks: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));
vi.mock("../repositories/invoice.repository", () => ({
  listUnpaid: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./compliance.service", () => ({
  listFilings: vi.fn(),
}));
vi.mock("./pnl.service", () => ({
  getPnlStatement: vi.fn(),
}));
vi.mock("./email/email.gateway", () => ({
  sendEmail: vi.fn(),
}));

import * as accountantLinkRepo from "../repositories/accountant-link.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as complianceService from "./compliance.service";
import * as pnlService from "./pnl.service";
import * as emailGateway from "./email/email.gateway";
import * as accountantReportService from "./accountant-report.service";

function pnlStub(overrides: Record<string, unknown> = {}) {
  return {
    income: 500000,
    expensesByCategory: { rent: 100000, utilities: 20000 },
    totalExpenses: 120000,
    netProfit: 380000,
    ...overrides,
  };
}

describe("accountant-report.service", () => {
  const orgId = randomUUID();
  const accountantEmail = "accountant@example.com";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      name: "Test Org",
      baseCurrency: "NGN",
    } as never);
    vi.mocked(pnlService.getPnlStatement).mockResolvedValue(pnlStub() as never);
    vi.mocked(invoiceRepo.listUnpaid).mockResolvedValue([]);
    vi.mocked(complianceService.listFilings).mockResolvedValue([]);
  });

  describe("sendMonthlyReport", () => {
    it("emails the accountant with the org's real P&L and outstanding-invoice figures", async () => {
      vi.mocked(invoiceRepo.listUnpaid).mockResolvedValue([
        { total: 30000 } as never,
        { total: 20000 } as never,
      ]);

      await accountantReportService.sendMonthlyReport(orgId, accountantEmail, "2026-08");

      expect(emailGateway.sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, text] = vi.mocked(emailGateway.sendEmail).mock.calls[0]!;
      expect(to).toBe(accountantEmail);
      expect(subject).toContain("Test Org");
      expect(text).toContain("50,000.00"); // outstanding total (30,000 + 20,000)
      expect(text).toContain("380,000.00"); // net profit
    });

    it("includes the next unfiled compliance obligation, labeled and dated", async () => {
      const dueDate = new Date("2026-09-21");
      vi.mocked(complianceService.listFilings).mockResolvedValue([
        { obligationType: "vat", status: "due", dueDate } as never,
        { obligationType: "paye", status: "filed", dueDate: new Date("2026-08-01") } as never,
      ]);

      await accountantReportService.sendMonthlyReport(orgId, accountantEmail, "2026-08");

      const [, , text] = vi.mocked(emailGateway.sendEmail).mock.calls[0]!;
      expect(text).toContain("VAT return");
    });

    it("writes an audit log entry on success", async () => {
      await accountantReportService.sendMonthlyReport(orgId, accountantEmail, "2026-08");

      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId,
          action: "accountant_report.sent",
          newValue: expect.objectContaining({ accountantEmail, month: "2026-08" }),
        }),
      );
    });

    it("never throws — a send failure is caught, logged, and skips the audit log", async () => {
      vi.mocked(emailGateway.sendEmail).mockRejectedValueOnce(new Error("Resend is down"));

      await expect(
        accountantReportService.sendMonthlyReport(orgId, accountantEmail, "2026-08"),
      ).resolves.toBeUndefined();

      expect(auditLogRepo.write).not.toHaveBeenCalled();
    });
  });

  describe("sendMonthlyReportsForAllAccountants", () => {
    it("sends a report for every active link, for the month that just completed", async () => {
      const linkA = { orgId: randomUUID(), accountantEmail: "a@example.com" };
      const linkB = { orgId: randomUUID(), accountantEmail: "b@example.com" };
      vi.mocked(accountantLinkRepo.listAllActiveLinks).mockResolvedValue([linkA, linkB]);

      const result = await accountantReportService.sendMonthlyReportsForAllAccountants(
        new Date("2026-09-05T00:00:00Z"),
      );

      expect(result).toEqual({ linkCount: 2 });
      expect(emailGateway.sendEmail).toHaveBeenCalledTimes(2);
      const [toA, subjectA] = vi.mocked(emailGateway.sendEmail).mock.calls[0]!;
      expect(toA).toBe("a@example.com");
      expect(subjectA).toContain("Test Org");
      // Called on Sept 5th — the month that "just completed" is August, not September.
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ newValue: expect.objectContaining({ month: "2026-08" }) }),
      );
    });

    it("one accountant's failure doesn't stop the rest of the batch", async () => {
      const linkA = { orgId: randomUUID(), accountantEmail: "a@example.com" };
      const linkB = { orgId: randomUUID(), accountantEmail: "b@example.com" };
      vi.mocked(accountantLinkRepo.listAllActiveLinks).mockResolvedValue([linkA, linkB]);
      vi.mocked(emailGateway.sendEmail).mockRejectedValueOnce(new Error("boom"));

      const result = await accountantReportService.sendMonthlyReportsForAllAccountants();

      expect(result.linkCount).toBe(2);
      expect(emailGateway.sendEmail).toHaveBeenCalledTimes(2);
    });
  });
});
