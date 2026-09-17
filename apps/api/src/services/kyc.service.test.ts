import { randomUUID, randomBytes } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/kyc.repository", () => ({
  findByOrg: vi.fn(),
  upsertNin: vi.fn(),
  upsertBvn: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
// Same reasoning as every other service test in this file — lib/env.ts's
// top-level schema parse runs before any beforeEach patching of process.env
// can take effect.
vi.mock("../lib/env", () => ({
  env: { KYC_ENCRYPTION_KEY_BASE64: undefined as string | undefined },
}));

import * as kycRepo from "../repositories/kyc.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { env } from "../lib/env";
import * as kycService from "./kyc.service";

describe("kyc.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    env.KYC_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString("base64");
  });

  describe("getStatus", () => {
    it("reports both submitted and verified as false when nothing is on file", async () => {
      vi.mocked(kycRepo.findByOrg).mockResolvedValue(null);

      const status = await kycService.getStatus(orgId);

      expect(status).toEqual({
        ninSubmitted: false,
        ninVerified: false,
        bvnSubmitted: false,
        bvnVerified: false,
      });
    });

    it("reports submitted-but-not-verified honestly (no verification provider is wired yet)", async () => {
      vi.mocked(kycRepo.findByOrg).mockResolvedValue({
        ninSubmittedAt: new Date(),
        ninVerifiedAt: null,
        bvnSubmittedAt: new Date(),
        bvnVerifiedAt: null,
      } as never);

      const status = await kycService.getStatus(orgId);

      expect(status).toEqual({
        ninSubmitted: true,
        ninVerified: false,
        bvnSubmitted: true,
        bvnVerified: false,
      });
    });
  });

  describe("submitNin", () => {
    it("rejects anything that isn't exactly 11 digits", async () => {
      await expect(kycService.submitNin(orgId, "123")).rejects.toThrow(/11 digits/);
      await expect(kycService.submitNin(orgId, "12345678901234")).rejects.toThrow(/11 digits/);
      await expect(kycService.submitNin(orgId, "1234567890a")).rejects.toThrow(/11 digits/);
      expect(kycRepo.upsertNin).not.toHaveBeenCalled();
    });

    it("encrypts the NIN before storing it and writes an audit entry", async () => {
      await kycService.submitNin(orgId, "12345678901");

      const [, storedEncrypted] = vi.mocked(kycRepo.upsertNin).mock.calls[0]!;
      expect(storedEncrypted).not.toBe("12345678901");
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ orgId, action: "kyc.nin_submitted" }),
      );
    });

    it("throws a clear error when encryption isn't configured, before touching the repository", async () => {
      env.KYC_ENCRYPTION_KEY_BASE64 = undefined;

      await expect(kycService.submitNin(orgId, "12345678901")).rejects.toThrow(/not configured/);
      expect(kycRepo.upsertNin).not.toHaveBeenCalled();
    });
  });

  describe("submitBvn", () => {
    it("rejects anything that isn't exactly 11 digits", async () => {
      await expect(kycService.submitBvn(orgId, "123")).rejects.toThrow(/11 digits/);
      expect(kycRepo.upsertBvn).not.toHaveBeenCalled();
    });

    it("encrypts the BVN before storing it", async () => {
      await kycService.submitBvn(orgId, "10987654321");

      const [, storedEncrypted] = vi.mocked(kycRepo.upsertBvn).mock.calls[0]!;
      expect(storedEncrypted).not.toBe("10987654321");
    });
  });
});
