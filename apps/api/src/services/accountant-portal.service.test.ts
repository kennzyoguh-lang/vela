import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
});

vi.mock("../repositories/accountant-link.repository", () => ({
  listForAccountant: vi.fn(),
  accept: vi.fn(),
  findActiveLink: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));
vi.mock("../repositories/invoice.repository", () => ({
  listByOrg: vi.fn(),
}));
vi.mock("./compliance.service", () => ({
  listFilings: vi.fn(),
}));
vi.mock("../repositories/bank-account.repository", () => ({
  listActiveByOrg: vi.fn(),
}));
vi.mock("../repositories/payroll-run.repository", () => ({
  listByOrg: vi.fn(),
}));

import * as accountantLinkRepo from "../repositories/accountant-link.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as complianceService from "./compliance.service";
import * as bankAccountRepo from "../repositories/bank-account.repository";
import * as payrollRunRepo from "../repositories/payroll-run.repository";
import * as accountantPortalService from "./accountant-portal.service";

describe("accountant-portal.service", () => {
  const userId = randomUUID();
  const email = "accountant@example.com";
  const clientOrgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("acceptLink", () => {
    it("accepts a pending invitation addressed to this user's own email", async () => {
      const linkId = randomUUID();
      vi.mocked(accountantLinkRepo.listForAccountant).mockResolvedValue([
        {
          id: linkId,
          orgId: clientOrgId,
          status: "pending",
          invitedAt: new Date(),
          respondedAt: null,
        },
      ]);
      vi.mocked(accountantLinkRepo.accept).mockResolvedValue({ id: linkId } as never);

      await accountantPortalService.acceptLink(userId, email, linkId);

      expect(accountantLinkRepo.accept).toHaveBeenCalledWith(clientOrgId, linkId, userId);
    });

    it("throws NotFoundError for a link id not addressed to this user/email", async () => {
      vi.mocked(accountantLinkRepo.listForAccountant).mockResolvedValue([]);

      await expect(accountantPortalService.acceptLink(userId, email, randomUUID())).rejects.toThrow(
        /not found/i,
      );
      expect(accountantLinkRepo.accept).not.toHaveBeenCalled();
    });

    it("rejects accepting a link that is already active (not pending)", async () => {
      const linkId = randomUUID();
      vi.mocked(accountantLinkRepo.listForAccountant).mockResolvedValue([
        {
          id: linkId,
          orgId: clientOrgId,
          status: "active",
          invitedAt: new Date(),
          respondedAt: new Date(),
        },
      ]);

      await expect(accountantPortalService.acceptLink(userId, email, linkId)).rejects.toThrow(
        /no longer pending/,
      );
      expect(accountantLinkRepo.accept).not.toHaveBeenCalled();
    });

    it("rejects accepting a link that was already revoked", async () => {
      const linkId = randomUUID();
      vi.mocked(accountantLinkRepo.listForAccountant).mockResolvedValue([
        {
          id: linkId,
          orgId: clientOrgId,
          status: "revoked",
          invitedAt: new Date(),
          respondedAt: null,
        },
      ]);

      await expect(accountantPortalService.acceptLink(userId, email, linkId)).rejects.toThrow(
        /no longer pending/,
      );
    });
  });

  describe("getClientOrgSummary", () => {
    it("denies access when no active link exists for this user in the client org", async () => {
      vi.mocked(accountantLinkRepo.findActiveLink).mockResolvedValue(null);

      await expect(
        accountantPortalService.getClientOrgSummary(userId, clientOrgId),
      ).rejects.toThrow(/don't have access/);
      expect(invoiceRepo.listByOrg).not.toHaveBeenCalled();
      expect(complianceService.listFilings).not.toHaveBeenCalled();
      expect(bankAccountRepo.listActiveByOrg).not.toHaveBeenCalled();
      expect(payrollRunRepo.listByOrg).not.toHaveBeenCalled();
    });

    it("returns a read-only summary when an active link exists", async () => {
      vi.mocked(accountantLinkRepo.findActiveLink).mockResolvedValue({ id: randomUUID() } as never);
      vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
        id: clientOrgId,
        name: "Client Co",
        baseCurrency: "NGN",
      } as never);
      vi.mocked(invoiceRepo.listByOrg).mockResolvedValue([
        { status: "overdue", total: "1000" },
        { status: "paid", total: "5000" },
      ] as never);
      vi.mocked(complianceService.listFilings).mockResolvedValue([]);
      vi.mocked(bankAccountRepo.listActiveByOrg).mockResolvedValue([
        { currentBalance: "2000" },
      ] as never);
      vi.mocked(payrollRunRepo.listByOrg).mockResolvedValue([]);

      const summary = await accountantPortalService.getClientOrgSummary(userId, clientOrgId);

      expect(summary.orgName).toBe("Client Co");
      expect(summary.baseCurrency).toBe("NGN");
      expect(summary.outstandingInvoicesTotal).toBe(1000);
      expect(summary.outstandingInvoicesCount).toBe(1);
      expect(summary.cashPosition).toBe(2000);
      expect(summary.currentPayrollRun).toBeNull();
    });
  });
});
