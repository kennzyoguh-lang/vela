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
  markEmailVerified: vi.fn(),
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
  signEmailVerificationToken: vi.fn(() => "verify-token"),
  verifyEmailVerificationToken: vi.fn(),
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
vi.mock("./calculator-lead.service", () => ({
  markConverted: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./referral.service", () => ({
  resolveCode: vi.fn(),
}));
vi.mock("./email/email.gateway", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../email/templates/verify-email", () => ({
  verifyEmailEmail: vi.fn(() => ({ subject: "s", html: "h", text: "t" })),
}));

import * as organisationRepo from "../repositories/organisation.repository";
import * as userRepo from "../repositories/user.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as passwordService from "./password.service";
import * as jwtService from "./jwt.service";
import * as twofaService from "./twofa.service";
import * as rateLimitService from "./rate-limit.service";
import * as referralService from "./referral.service";
import * as emailGateway from "./email/email.gateway";
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

  describe("signup", () => {
    function stubSignupPlumbing() {
      const orgId = randomUUID();
      const userId = randomUUID();
      vi.mocked(userRepo.findByEmail).mockResolvedValue(null as never);
      vi.mocked(organisationRepo.createOrganisation).mockResolvedValue({ id: orgId } as never);
      vi.mocked(userRepo.createUser).mockResolvedValue({ id: userId } as never);
      return { orgId, userId };
    }

    it("never resolves a referral code when none was provided", async () => {
      stubSignupPlumbing();

      await authService.signup({
        orgName: "Ada's Textiles",
        name: "Ada",
        email: "ada@example.com",
        password: "correct-horse-battery",
        country: "NG",
      });

      expect(referralService.resolveCode).not.toHaveBeenCalled();
      expect(organisationRepo.createOrganisation).toHaveBeenCalledWith(
        expect.objectContaining({ referredByOrgId: undefined, referredByCodeId: undefined }),
      );
    });

    it("resolves a referredBy code and stores both ids on the new org", async () => {
      stubSignupPlumbing();
      vi.mocked(referralService.resolveCode).mockResolvedValue({
        orgId: "referrer-org",
        codeId: "code-1",
      });

      await authService.signup({
        orgName: "Ada's Textiles",
        name: "Ada",
        email: "ada@example.com",
        password: "correct-horse-battery",
        country: "NG",
        referredBy: "ABCD123",
      });

      expect(referralService.resolveCode).toHaveBeenCalledWith("ABCD123");
      expect(organisationRepo.createOrganisation).toHaveBeenCalledWith(
        expect.objectContaining({ referredByOrgId: "referrer-org", referredByCodeId: "code-1" }),
      );
    });

    it("never blocks signup when referral-code resolution fails", async () => {
      const { orgId } = stubSignupPlumbing();
      vi.mocked(referralService.resolveCode).mockRejectedValue(new Error("db hiccup"));

      await expect(
        authService.signup({
          orgName: "Ada's Textiles",
          name: "Ada",
          email: "ada@example.com",
          password: "correct-horse-battery",
          country: "NG",
          referredBy: "ABCD123",
        }),
      ).resolves.toMatchObject({ orgId, accessToken: "access-token" });
      expect(organisationRepo.createOrganisation).toHaveBeenCalledWith(
        expect.objectContaining({ referredByOrgId: undefined, referredByCodeId: undefined }),
      );
    });
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

    it("rejects a wrong password without issuing a session or a challenge, and audit-logs the failure", async () => {
      const user = stubUser();
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user as never);
      vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);

      await expect(
        authService.login({ email: "user@example.com", password: "wrong" }, {}),
      ).rejects.toThrow(/invalid email or password/i);
      expect(sessionRepo.createSession).not.toHaveBeenCalled();
      expect(jwtService.signTwoFaChallengeToken).not.toHaveBeenCalled();
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: user.orgId,
          userId: user.id,
          action: "auth.login_failed",
        }),
      );
    });

    it("rejects a deactivated user and audit-logs the failure", async () => {
      const user = stubUser({ isActive: false });
      vi.mocked(userRepo.findByEmail).mockResolvedValue(user as never);

      await expect(
        authService.login({ email: "user@example.com", password: "whatever" }, {}),
      ).rejects.toThrow(/invalid email or password/i);
      expect(passwordService.verifyPassword).not.toHaveBeenCalled();
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: user.orgId,
          userId: user.id,
          action: "auth.login_failed",
        }),
      );
    });

    it("does not audit-log when the email doesn't resolve to any user (no org to attach it to)", async () => {
      vi.mocked(userRepo.findByEmail).mockResolvedValue(null as never);

      await expect(
        authService.login({ email: "nobody@example.com", password: "whatever" }, {}),
      ).rejects.toThrow(/invalid email or password/i);
      expect(auditLogRepo.write).not.toHaveBeenCalled();
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

  describe("verifyEmail", () => {
    const orgId = randomUUID();
    const userId = randomUUID();

    it("marks the account verified on a valid token", async () => {
      vi.mocked(jwtService.verifyEmailVerificationToken).mockReturnValue({ sub: userId, orgId });
      vi.mocked(userRepo.findById).mockResolvedValue(
        stubUser({ id: userId, orgId, emailVerifiedAt: null }) as never,
      );

      await authService.verifyEmail("some-token");

      expect(userRepo.markEmailVerified).toHaveBeenCalledWith(orgId, userId);
    });

    it("is a no-op — not an error — when the account is already verified", async () => {
      vi.mocked(jwtService.verifyEmailVerificationToken).mockReturnValue({ sub: userId, orgId });
      vi.mocked(userRepo.findById).mockResolvedValue(
        stubUser({ id: userId, orgId, emailVerifiedAt: new Date() }) as never,
      );

      await authService.verifyEmail("some-token");

      expect(userRepo.markEmailVerified).not.toHaveBeenCalled();
    });

    it("rejects an expired or tampered token before ever looking up the user", async () => {
      vi.mocked(jwtService.verifyEmailVerificationToken).mockImplementation(() => {
        throw new Error("jwt expired");
      });

      await expect(authService.verifyEmail("bad-token")).rejects.toThrow(
        /verification link expired or invalid/i,
      );
      expect(userRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe("resendVerificationEmail", () => {
    const orgId = randomUUID();
    const userId = randomUUID();

    it("sends a fresh verification email to an unverified account", async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(
        stubUser({
          id: userId,
          orgId,
          email: "ada@example.com",
          name: "Ada",
          emailVerifiedAt: null,
        }) as never,
      );

      await authService.resendVerificationEmail(orgId, userId);

      expect(jwtService.signEmailVerificationToken).toHaveBeenCalledWith({
        sub: userId,
        orgId,
      });
      expect(emailGateway.sendEmail).toHaveBeenCalledWith("ada@example.com", "s", "t", "h");
    });

    it("is a silent no-op for an already-verified account", async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(
        stubUser({
          id: userId,
          orgId,
          email: "ada@example.com",
          emailVerifiedAt: new Date(),
        }) as never,
      );

      await authService.resendVerificationEmail(orgId, userId);

      expect(emailGateway.sendEmail).not.toHaveBeenCalled();
    });

    it("is a silent no-op for a phone+PIN staff account with no email", async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(
        stubUser({ id: userId, orgId, email: null, emailVerifiedAt: null }) as never,
      );

      await authService.resendVerificationEmail(orgId, userId);

      expect(emailGateway.sendEmail).not.toHaveBeenCalled();
    });
  });
});
