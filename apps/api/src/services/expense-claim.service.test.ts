import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/expense-claim.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listAllByOrg: vi.fn(),
  listBySubmitter: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../repositories/stored-file.repository", () => ({
  findById: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));

import * as expenseClaimRepo from "../repositories/expense-claim.repository";
import * as storedFileRepo from "../repositories/stored-file.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as expenseClaimService from "./expense-claim.service";

const PAGE = { skip: 0, take: 20, page: 1, pageSize: 20 };

function claimInput(overrides: Record<string, unknown> = {}) {
  return {
    submittedByUserId: randomUUID(),
    category: "transport" as const,
    vendor: "Uber",
    amount: 5000,
    currency: "NGN",
    expenseDate: new Date("2026-08-10"),
    ...overrides,
  };
}

describe("expense-claim.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitClaim", () => {
    it("creates the claim and writes an audit entry", async () => {
      const input = claimInput();
      vi.mocked(expenseClaimRepo.create).mockResolvedValue({ id: randomUUID() } as never);

      await expenseClaimService.submitClaim(orgId, input);

      expect(expenseClaimRepo.create).toHaveBeenCalledWith(orgId, input);
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ orgId, action: "expense_claim.submitted" }),
      );
    });

    it("verifies an attached receipt belongs to this org before accepting the claim", async () => {
      const receiptFileId = randomUUID();
      vi.mocked(storedFileRepo.findById).mockResolvedValue(null);

      await expect(
        expenseClaimService.submitClaim(orgId, claimInput({ receiptFileId })),
      ).rejects.toThrow(/not found/);
      expect(expenseClaimRepo.create).not.toHaveBeenCalled();
    });

    it("accepts a claim whose receipt does belong to this org", async () => {
      const receiptFileId = randomUUID();
      vi.mocked(storedFileRepo.findById).mockResolvedValue({ id: receiptFileId } as never);
      vi.mocked(expenseClaimRepo.create).mockResolvedValue({ id: randomUUID() } as never);

      await expenseClaimService.submitClaim(orgId, claimInput({ receiptFileId }));

      expect(expenseClaimRepo.create).toHaveBeenCalled();
    });
  });

  describe("listAllClaims / listMyClaims", () => {
    it("delegates to the org-wide listing", async () => {
      await expenseClaimService.listAllClaims(orgId, PAGE);
      expect(expenseClaimRepo.listAllByOrg).toHaveBeenCalledWith(orgId, PAGE);
    });

    it("delegates to the per-submitter listing", async () => {
      const userId = randomUUID();
      await expenseClaimService.listMyClaims(orgId, userId, PAGE);
      expect(expenseClaimRepo.listBySubmitter).toHaveBeenCalledWith(orgId, userId, PAGE);
    });
  });

  describe("approveClaim / rejectClaim", () => {
    it("approves a pending claim and writes an audit entry", async () => {
      const claimId = randomUUID();
      const reviewerId = randomUUID();
      vi.mocked(expenseClaimRepo.findById).mockResolvedValue({
        id: claimId,
        status: "pending",
      } as never);
      vi.mocked(expenseClaimRepo.review).mockResolvedValue({
        id: claimId,
        status: "approved",
      } as never);

      const result = await expenseClaimService.approveClaim(orgId, claimId, reviewerId);

      expect(expenseClaimRepo.review).toHaveBeenCalledWith(orgId, claimId, "approved", reviewerId);
      expect(result).toMatchObject({ status: "approved" });
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: "expense_claim.approved" }),
      );
    });

    it("rejects a pending claim with a reason", async () => {
      const claimId = randomUUID();
      const reviewerId = randomUUID();
      vi.mocked(expenseClaimRepo.findById).mockResolvedValue({
        id: claimId,
        status: "pending",
      } as never);
      vi.mocked(expenseClaimRepo.review).mockResolvedValue({
        id: claimId,
        status: "rejected",
      } as never);

      await expenseClaimService.rejectClaim(orgId, claimId, reviewerId, "Missing receipt");

      expect(expenseClaimRepo.review).toHaveBeenCalledWith(
        orgId,
        claimId,
        "rejected",
        reviewerId,
        "Missing receipt",
      );
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "expense_claim.rejected",
          newValue: { reason: "Missing receipt" },
        }),
      );
    });

    it("refuses to review a claim that's already been decided", async () => {
      const claimId = randomUUID();
      vi.mocked(expenseClaimRepo.findById).mockResolvedValue({
        id: claimId,
        status: "approved",
      } as never);

      await expect(expenseClaimService.approveClaim(orgId, claimId, randomUUID())).rejects.toThrow(
        /already been approved/,
      );
      expect(expenseClaimRepo.review).not.toHaveBeenCalled();
    });

    it("throws when the claim doesn't exist", async () => {
      vi.mocked(expenseClaimRepo.findById).mockResolvedValue(null);

      await expect(
        expenseClaimService.rejectClaim(orgId, randomUUID(), randomUUID(), "reason"),
      ).rejects.toThrow(/not found/);
    });
  });
});
