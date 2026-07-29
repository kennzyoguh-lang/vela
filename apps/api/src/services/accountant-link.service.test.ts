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
  findByEmail: vi.fn(),
  create: vi.fn(),
  reinvite: vi.fn(),
  listByOrg: vi.fn(),
  findById: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));

import * as accountantLinkRepo from "../repositories/accountant-link.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as accountantLinkService from "./accountant-link.service";

describe("accountant-link.service", () => {
  const orgId = randomUUID();
  const invitedBy = randomUUID();
  const email = "accountant@example.com";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("inviteAccountant", () => {
    it("creates a new link when no existing row for this (org, email) pair", async () => {
      vi.mocked(accountantLinkRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(accountantLinkRepo.create).mockResolvedValue({ id: randomUUID() } as never);

      await accountantLinkService.inviteAccountant(orgId, invitedBy, email);

      expect(accountantLinkRepo.create).toHaveBeenCalledWith(orgId, {
        accountantEmail: email,
        invitedBy,
      });
      expect(accountantLinkRepo.reinvite).not.toHaveBeenCalled();
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ orgId, userId: invitedBy, action: "accountant_link.invited" }),
      );
    });

    it("re-invites (resets to pending) a previously revoked link instead of inserting a duplicate", async () => {
      const linkId = randomUUID();
      vi.mocked(accountantLinkRepo.findByEmail).mockResolvedValue({
        id: linkId,
        status: "revoked",
      } as never);
      vi.mocked(accountantLinkRepo.reinvite).mockResolvedValue({ id: linkId } as never);

      await accountantLinkService.inviteAccountant(orgId, invitedBy, email);

      expect(accountantLinkRepo.reinvite).toHaveBeenCalledWith(orgId, linkId, invitedBy);
      expect(accountantLinkRepo.create).not.toHaveBeenCalled();
    });

    it("rejects re-inviting an email that already has a pending link", async () => {
      vi.mocked(accountantLinkRepo.findByEmail).mockResolvedValue({
        id: randomUUID(),
        status: "pending",
      } as never);

      await expect(accountantLinkService.inviteAccountant(orgId, invitedBy, email)).rejects.toThrow(
        /already has an active or pending link/,
      );
      expect(accountantLinkRepo.create).not.toHaveBeenCalled();
      expect(accountantLinkRepo.reinvite).not.toHaveBeenCalled();
    });

    it("rejects re-inviting an email that already has an active link", async () => {
      vi.mocked(accountantLinkRepo.findByEmail).mockResolvedValue({
        id: randomUUID(),
        status: "active",
      } as never);

      await expect(accountantLinkService.inviteAccountant(orgId, invitedBy, email)).rejects.toThrow(
        /already has an active or pending link/,
      );
    });
  });

  describe("revokeLink", () => {
    it("throws NotFoundError when the link doesn't belong to this org", async () => {
      vi.mocked(accountantLinkRepo.findById).mockResolvedValue(null);

      await expect(
        accountantLinkService.revokeLink(orgId, invitedBy, randomUUID()),
      ).rejects.toThrow(/not found/i);
      expect(accountantLinkRepo.revoke).not.toHaveBeenCalled();
    });

    it("revokes and audit-logs an existing link", async () => {
      const linkId = randomUUID();
      vi.mocked(accountantLinkRepo.findById).mockResolvedValue({ id: linkId } as never);

      await accountantLinkService.revokeLink(orgId, invitedBy, linkId);

      expect(accountantLinkRepo.revoke).toHaveBeenCalledWith(orgId, linkId);
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: "accountant_link.revoked" }),
      );
    });
  });
});
