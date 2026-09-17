import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// Extracted from twofa.service.ts's original encryptTwoFaSecret/
// decryptTwoFaSecret — same AES-256-GCM shape, generalized so a second
// caller (org-supplied payment processor credentials) doesn't duplicate
// this exact cipher logic with its own copy to audit separately. Callers
// each supply their own key material and AAD; this module holds no key
// itself and makes no assumption about what's being encrypted.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * `aad` (additional authenticated data) should be something that uniquely
 * identifies the row this ciphertext belongs to (a user id, an org+processor
 * pair, ...) — binding it into the auth tag means a ciphertext ever
 * associated with the wrong row (bad migration, restore mismatch, a copy-
 * paste bug) fails to decrypt instead of silently decrypting against the
 * wrong owner.
 */
export function encryptSecret(plain: string, keyBase64: string, aad: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string, keyBase64: string, aad: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
