import { randomBytes } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { authenticator } from "otplib";

// twofa.service.ts now imports lib/env.ts (for the encryption key), so this
// file must set required env vars in beforeAll and import the module under
// test dynamically — a static top-level import would run env.ts's
// envSchema.parse(process.env) before beforeAll ever executes.
beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
  // A real 32-byte key — the encrypt/decrypt tests below exercise the actual
  // AES-256-GCM round-trip, unlike the other files' inert placeholder value.
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= randomBytes(32).toString("base64");
});

describe("twofa.service", () => {
  it("verifies a code generated from the same secret", async () => {
    const { generateTotpSecret, verifyTotpCode } = await import("./twofa.service");
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects a code generated from a different secret", async () => {
    const { generateTotpSecret, verifyTotpCode } = await import("./twofa.service");
    const secret = generateTotpSecret();
    const otherSecret = generateTotpSecret();
    const code = authenticator.generate(otherSecret);
    expect(verifyTotpCode(secret, code)).toBe(false);
  });

  it("generates 8 unique backup codes", async () => {
    const { generateBackupCodes } = await import("./twofa.service");
    const { plain } = await generateBackupCodes();
    expect(plain).toHaveLength(8);
    expect(new Set(plain).size).toBe(8);
  });

  it("consumes a backup code exactly once — it is removed from the remaining set", async () => {
    const { generateBackupCodes, consumeBackupCode } = await import("./twofa.service");
    const { plain, hashed } = await generateBackupCodes();
    const firstCode = plain[0]!;

    const firstAttempt = await consumeBackupCode(firstCode, hashed);
    expect(firstAttempt.matched).toBe(true);
    expect(firstAttempt.remaining).toHaveLength(7);

    const secondAttempt = await consumeBackupCode(firstCode, firstAttempt.remaining);
    expect(secondAttempt.matched).toBe(false);
    expect(secondAttempt.remaining).toHaveLength(7);
  });

  it("rejects a code that was never issued", async () => {
    const { generateBackupCodes, consumeBackupCode } = await import("./twofa.service");
    const { hashed } = await generateBackupCodes();
    const result = await consumeBackupCode("0000000000", hashed);
    expect(result.matched).toBe(false);
  });

  describe("encryptTwoFaSecret / decryptTwoFaSecret", () => {
    it("round-trips a secret through encrypt then decrypt", async () => {
      const { encryptTwoFaSecret, decryptTwoFaSecret, generateTotpSecret } =
        await import("./twofa.service");
      const secret = generateTotpSecret();
      const ciphertext = encryptTwoFaSecret(secret, "user-1");
      expect(decryptTwoFaSecret(ciphertext, "user-1")).toBe(secret);
    });

    it("produces different ciphertext each time (random IV)", async () => {
      const { encryptTwoFaSecret, generateTotpSecret } = await import("./twofa.service");
      const secret = generateTotpSecret();
      const a = encryptTwoFaSecret(secret, "user-1");
      const b = encryptTwoFaSecret(secret, "user-1");
      expect(a).not.toBe(b);
    });

    it("fails to decrypt with the wrong AAD (ciphertext bound to a different user)", async () => {
      const { encryptTwoFaSecret, decryptTwoFaSecret, generateTotpSecret } =
        await import("./twofa.service");
      const secret = generateTotpSecret();
      const ciphertext = encryptTwoFaSecret(secret, "user-1");
      expect(() => decryptTwoFaSecret(ciphertext, "user-2")).toThrow();
    });

    it("fails to decrypt a tampered ciphertext", async () => {
      const { encryptTwoFaSecret, decryptTwoFaSecret, generateTotpSecret } =
        await import("./twofa.service");
      const secret = generateTotpSecret();
      const ciphertext = encryptTwoFaSecret(secret, "user-1");
      const raw = Buffer.from(ciphertext, "base64");
      raw[raw.length - 1] = (raw[raw.length - 1]! ^ 0xff) & 0xff; // flip the last ciphertext byte
      const tampered = raw.toString("base64");
      expect(() => decryptTwoFaSecret(tampered, "user-1")).toThrow();
    });
  });
});
