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
});
