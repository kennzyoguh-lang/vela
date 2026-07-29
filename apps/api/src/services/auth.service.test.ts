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

vi.mock("../repositories/organisation.repository", () => ({
  createOrganisation: vi.fn(),
  setOrganisationOwner: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  createUser: vi.fn(),
  updateLastLogin: vi.fn(),
  updateBackupCodes: vi.fn(),
}));
vi.mock("../repositories/session.repository", () => ({
  createSession: vi.fn(),
  findActiveByFamily: vi.fn(),
  terminateSession: vi.fn(),
  terminateFamily: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./password.service", () => ({
  hashPassword: vi.fn(async () => "hashed"),
  verifyPassword: vi.fn(),
  hashToken: vi.fn(async () => "hashed-token"),
  verifyTokenHash: vi.fn(),
}));
vi.mock("./jwt.service", () => ({
  signAccessToken: vi.fn(() => "access-token"),
  newRefreshToken: vi.fn(() => ({ token: "refresh-token", familyId: randomUUID() })),
  rotateRefreshToken: vi.fn(() => "rotated-refresh-token"),
  signTwoFaChallengeToken: vi.fn(() => "challenge-token"),
  verifyTwoFaChallengeToken: vi.fn(),
}));
vi.mock("./twofa.service", () => ({
  verifyTotpCode: vi.fn(),
  consumeBackupCode: vi.fn(),
  decryptTwoFaSecret: vi.fn(() => "decrypted-secret"),
}));
vi.mock("./rate-limit.service", () => ({
  isTwoFaLockedOut: vi.fn(async () => false),
  recordTwoFaFailure: vi.fn(),
  clearTwoFaFailures: vi.fn(),
}));

import * as userRepo from "../repositories/user.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as passwordService from "./password.service";
import * as jwtService from "./jwt.service";
import * as twofaService from "./twofa.service";
import * as rateLimitService from "./rate-limit.service";
import * as authService from "./auth.service";

function stubUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    orgId: randomUUID(),
    role: "owner",
    passwordHash: "hashed",
    isActive: true,
    twoFaEnabled: false,
    twoFaSecretEncrypted: null,
    backupCodesHash: [] as string[],
    ...overrides,
  };
}

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimitService.isTwoFaLockedOut).mockResolvedValue(false);
  });

  describe("login", () => {
    it("issues a full session when 2FA is not enabled", async () => {
      const user = stubUser({ twoFaEnabled: false });
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user as never);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

      const result = await authService.login(
        { email: "user@example.com", password: "correct" },
        {},
      );

      expect(result.requiresTwoFa).toBe(false);
      if (!result.requiresTwoFa) {
        expect(result.accessToken).toBe("access-token");
      }
      expect(sessionRepo.createSession).toHaveBeenCalledTimes(1);
      expect(jwtService.signTwoFaChallengeToken).not.toHaveBeenCalled();
    });

    it("returns a challenge branch — and issues NO session — when 2FA is enabled", async () => {
      const user = stubUser({ twoFaEnabled: true });
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user as never);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

      const result = await authService.login(
        { email: "user@example.com", password: "correct" },
        {},
      );

      expect(result.requiresTwoFa).toBe(true);
      if (result.requiresTwoFa) {
        expect(result.challengeToken).toBe("challenge-token");
        expect(result).not.toHaveProperty("accessToken");
      }
      expect(sessionRepo.createSession).not.toHaveBeenCalled();
    });

    it("rejects a wrong password without issuing a session or a challenge", async () => {
      const user = stubUser();
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user as never);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);

      await expect(
        authService.login({ email: "user@example.com", password: "wrong" }, {}),
      ).rejects.toThrow(/invalid email or password/i);
      expect(sessionRepo.createSession).not.toHaveBeenCalled();
      expect(jwtService.signTwoFaChallengeToken).not.toHaveBeenCalled();
    });

    it("rejects a deactivated user", async () => {
      const user = stubUser({ isActive: false });
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user as never);

      await expect(
        authService.login({ email: "user@example.com", password: "whatever" }, {}),
      ).rejects.toThrow(/invalid email or password/i);
      expect(passwordService.verifyPassword).not.toHaveBeenCalled();
    });
  });

  describe("verifyTwoFaChallenge", () => {
    const orgId = randomUUID();
    const userId = randomUUID();

    beforeEach(() => {
      vi.mocked(jwtService.verifyTwoFaChallengeToken).mockReturnValue({ sub: userId, orgId });
    });

    it("issues a session on a correct TOTP code", async () => {
      const user = stubUser({ id: userId, orgId, twoFaEnabled: true, twoFaSecretEncrypted: "ct" });
      vi.mocked(userRepo.findById).mockResolvedValue(user as never);
      vi.mocked(twofaService.verifyTotpCode).mockReturnValue(true);

      const result = await authService.verifyTwoFaChallenge("challenge-token", "123456", {});

      expect(result.accessToken).toBe("access-token");
      expect(sessionRepo.createSession).toHaveBeenCalledTimes(1);
      expect(rateLimitService.clearTwoFaFailures).toHaveBeenCalledWith(userId);
      expect(twofaService.consumeBackupCode).not.toHaveBeenCalled();
    });

    it("falls back to a backup code when the TOTP code is wrong, and issues a session", async () => {
      const user = stubUser({
        id: userId,
        orgId,
        twoFaEnabled: true,
        twoFaSecretEncrypted: "ct",
        backupCodesHash: ["h1", "h2"],
      });
      vi.mocked(userRepo.findById).mockResolvedValue(user as never);
      vi.mocked(twofaService.verifyTotpCode).mockReturnValue(false);
      vi.mocked(twofaService.consumeBackupCode).mockResolvedValue({
        matched: true,
        remaining: ["h2"],
      });

      const result = await authService.verifyTwoFaChallenge("challenge-token", "backupcode", {});

      expect(result.accessToken).toBe("access-token");
      expect(userRepo.updateBackupCodes).toHaveBeenCalledWith(orgId, userId, ["h2"]);
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: "2fa.backup_code_used" }),
      );
    });

    it("rejects a wrong code with no valid backup code, records a failure, issues no session", async () => {
      const user = stubUser({ id: userId, orgId, twoFaEnabled: true, twoFaSecretEncrypted: "ct" });
      vi.mocked(userRepo.findById).mockResolvedValue(user as never);
      vi.mocked(twofaService.verifyTotpCode).mockReturnValue(false);
      vi.mocked(twofaService.consumeBackupCode).mockResolvedValue({
        matched: false,
        remaining: [],
      });

      await expect(
        authService.verifyTwoFaChallenge("challenge-token", "000000", {}),
      ).rejects.toThrow(/invalid verification code/i);
      expect(rateLimitService.recordTwoFaFailure).toHaveBeenCalledWith(userId);
      expect(sessionRepo.createSession).not.toHaveBeenCalled();
    });

    it("rejects immediately when locked out — never touches the secret or calls verifyTotpCode", async () => {
      const user = stubUser({ id: userId, orgId, twoFaEnabled: true, twoFaSecretEncrypted: "ct" });
      vi.mocked(userRepo.findById).mockResolvedValue(user as never);
      vi.mocked(rateLimitService.isTwoFaLockedOut).mockResolvedValue(true);

      await expect(
        authService.verifyTwoFaChallenge("challenge-token", "123456", {}),
      ).rejects.toThrow(/too many failed attempts/i);
      expect(twofaService.verifyTotpCode).not.toHaveBeenCalled();
      expect(twofaService.decryptTwoFaSecret).not.toHaveBeenCalled();
    });

    it("rejects an expired or tampered challenge token before ever looking up the user", async () => {
      vi.mocked(jwtService.verifyTwoFaChallengeToken).mockImplementation(() => {
        throw new Error("jwt expired");
      });

      await expect(authService.verifyTwoFaChallenge("bad-token", "123456", {})).rejects.toThrow(
        /challenge expired or invalid/i,
      );
      expect(userRepo.findById).not.toHaveBeenCalled();
    });
  });
});
