import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";

// Generates a throwaway RS256 keypair so this test never depends on real
// secrets — env vars are set before importing the module under test, since
// jwt.service.ts reads them at module-load time.
beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString("base64");
  process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString("base64");
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= "placeholder";
});

describe("jwt.service", () => {
  it("round-trips claims through sign/verify", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./jwt.service");
    const token = signAccessToken({
      sub: "user-1",
      orgId: "org-1",
      role: "owner",
      sessionFamilyId: "family-1",
    });
    const claims = verifyAccessToken(token);
    expect(claims).toMatchObject({
      sub: "user-1",
      orgId: "org-1",
      role: "owner",
      sessionFamilyId: "family-1",
    });
  });

  it("rejects a token signed with a different key", async () => {
    const { verifyAccessToken } = await import("./jwt.service");
    const jwt = (await import("jsonwebtoken")).default;
    const { privateKey: otherKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
    });
    const forged = jwt.sign({ sub: "attacker", orgId: "org-1", role: "owner" }, otherKey, {
      algorithm: "RS256",
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it("generates distinct refresh tokens and family ids on each call", async () => {
    const { newRefreshToken } = await import("./jwt.service");
    const a = newRefreshToken();
    const b = newRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.familyId).not.toBe(b.familyId);
  });

  describe("2FA challenge token — structural separation from real access tokens", () => {
    it("round-trips claims through sign/verify", async () => {
      const { signTwoFaChallengeToken, verifyTwoFaChallengeToken } = await import("./jwt.service");
      const token = signTwoFaChallengeToken({ sub: "user-1", orgId: "org-1" });
      expect(verifyTwoFaChallengeToken(token)).toMatchObject({ sub: "user-1", orgId: "org-1" });
    });

    // The hard invariant: both token types share a signing key, so this
    // check — not the shape of the claims — is the only thing that stops a
    // password-verified-but-not-yet-2FA-confirmed token from being usable
    // as a real session.
    it("verifyAccessToken rejects a 2FA challenge token", async () => {
      const { signTwoFaChallengeToken, verifyAccessToken } = await import("./jwt.service");
      const challengeToken = signTwoFaChallengeToken({ sub: "user-1", orgId: "org-1" });
      expect(() => verifyAccessToken(challengeToken)).toThrow();
    });

    it("verifyTwoFaChallengeToken rejects a real access token", async () => {
      const { signAccessToken, verifyTwoFaChallengeToken } = await import("./jwt.service");
      const accessToken = signAccessToken({
        sub: "user-1",
        orgId: "org-1",
        role: "owner",
        sessionFamilyId: "family-1",
      });
      expect(() => verifyTwoFaChallengeToken(accessToken)).toThrow();
    });
  });

  describe("email verification token — structural separation from real access tokens", () => {
    it("round-trips claims through sign/verify", async () => {
      const { signEmailVerificationToken, verifyEmailVerificationToken } =
        await import("./jwt.service");
      const token = signEmailVerificationToken({ sub: "user-1", orgId: "org-1" });
      expect(verifyEmailVerificationToken(token)).toMatchObject({
        sub: "user-1",
        orgId: "org-1",
      });
    });

    it("verifyAccessToken rejects an email verification token", async () => {
      const { signEmailVerificationToken, verifyAccessToken } = await import("./jwt.service");
      const token = signEmailVerificationToken({ sub: "user-1", orgId: "org-1" });
      expect(() => verifyAccessToken(token)).toThrow();
    });

    it("verifyEmailVerificationToken rejects a real access token", async () => {
      const { signAccessToken, verifyEmailVerificationToken } = await import("./jwt.service");
      const accessToken = signAccessToken({
        sub: "user-1",
        orgId: "org-1",
        role: "owner",
        sessionFamilyId: "family-1",
      });
      expect(() => verifyEmailVerificationToken(accessToken)).toThrow();
    });

    it("verifyEmailVerificationToken rejects a 2FA challenge token", async () => {
      const { signTwoFaChallengeToken, verifyEmailVerificationToken } =
        await import("./jwt.service");
      const challengeToken = signTwoFaChallengeToken({ sub: "user-1", orgId: "org-1" });
      expect(() => verifyEmailVerificationToken(challengeToken)).toThrow();
    });

    // Reconstructs the same private key the module loaded from
    // JWT_PRIVATE_KEY_BASE64 (set in beforeAll) to forge an already-expired
    // token with the right audience — the one property signEmailVerificationToken
    // itself can't produce, since it always signs with the real 24h TTL.
    it("verifyEmailVerificationToken rejects an expired token", async () => {
      const { verifyEmailVerificationToken } = await import("./jwt.service");
      const jwt = (await import("jsonwebtoken")).default;
      const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64!, "base64").toString(
        "utf8",
      );
      const expired = jwt.sign({ sub: "user-1", orgId: "org-1" }, privateKey, {
        algorithm: "RS256",
        expiresIn: -10,
        audience: "email-verification",
      });
      expect(() => verifyEmailVerificationToken(expired)).toThrow();
    });
  });
});
