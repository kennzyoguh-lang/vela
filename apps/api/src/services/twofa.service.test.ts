import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  consumeBackupCode,
} from "./twofa.service";
import { authenticator } from "otplib";

describe("twofa.service", () => {
  it("verifies a code generated from the same secret", () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects a code generated from a different secret", () => {
    const secret = generateTotpSecret();
    const otherSecret = generateTotpSecret();
    const code = authenticator.generate(otherSecret);
    expect(verifyTotpCode(secret, code)).toBe(false);
  });

  it("generates 8 unique backup codes", async () => {
    const { plain } = await generateBackupCodes();
    expect(plain).toHaveLength(8);
    expect(new Set(plain).size).toBe(8);
  });

  it("consumes a backup code exactly once — it is removed from the remaining set", async () => {
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
    const { hashed } = await generateBackupCodes();
    const result = await consumeBackupCode("0000000000", hashed);
    expect(result.matched).toBe(false);
  });
});
