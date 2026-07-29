import { authenticator } from "otplib";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { hashToken, verifyTokenHash } from "./password.service";
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

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  return Buffer.from(env.TWO_FA_ENCRYPTION_KEY_BASE64, "base64");
}

// The TOTP secret must be reversible (unlike a password or backup code) —
// verifying a login-time code means recomputing the expected code from the
// original secret, which a one-way hash can never provide. `aad` (the
// owning user's id) is bound into the auth tag so a ciphertext ever
// associated with the wrong row (bad migration, restore mismatch) fails to
// decrypt instead of silently decrypting against the wrong account.
export function encryptTwoFaSecret(plain: string, aad: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptTwoFaSecret(encoded: string, aad: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
