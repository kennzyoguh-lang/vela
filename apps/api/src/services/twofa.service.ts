import { authenticator } from "otplib";
import { randomBytes } from "node:crypto";
import { hashToken, verifyTokenHash } from "./password.service";
import { encryptSecret, decryptSecret } from "../lib/encryption";
import { env } from "../lib/env";

// TOTP per RFC 6238 (BRD F-60 / Handbook 8.3). Mandatory for Owner at first
// login, optional elsewhere.
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpUri(secret: string, email: string): string {
  return authenticator.keyuri(email, "VELA", secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

// 8 single-use backup codes, hashed with the same algorithm as passwords,
// shown to the user exactly once (Handbook 8.3 / Design System 3.12).
export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: 8 }, () => randomBytes(5).toString("hex"));
  const hashed = await Promise.all(plain.map((code) => hashToken(code)));
  return { plain, hashed };
}

export async function consumeBackupCode(
  code: string,
  hashedCodes: string[],
): Promise<{ matched: boolean; remaining: string[] }> {
  for (const hashed of hashedCodes) {
    if (await verifyTokenHash(code, hashed)) {
      return { matched: true, remaining: hashedCodes.filter((h) => h !== hashed) };
    }
  }
  return { matched: false, remaining: hashedCodes };
}

// The TOTP secret must be reversible (unlike a password or backup code) —
// verifying a login-time code means recomputing the expected code from the
// original secret, which a one-way hash can never provide. `aad` (the
// owning user's id) is bound into the auth tag so a ciphertext ever
// associated with the wrong row (bad migration, restore mismatch) fails to
// decrypt instead of silently decrypting against the wrong account. The
// actual AES-256-GCM mechanics live in lib/encryption.ts, shared with any
// other field that needs reversible at-rest encryption (e.g. org-supplied
// payment processor credentials) rather than re-implemented per caller.
export function encryptTwoFaSecret(plain: string, aad: string): string {
  return encryptSecret(plain, env.TWO_FA_ENCRYPTION_KEY_BASE64, aad);
}

export function decryptTwoFaSecret(encoded: string, aad: string): string {
  return decryptSecret(encoded, env.TWO_FA_ENCRYPTION_KEY_BASE64, aad);
}
