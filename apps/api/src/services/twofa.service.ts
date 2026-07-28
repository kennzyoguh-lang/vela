import { authenticator } from "otplib";
import { randomBytes } from "node:crypto";
import { hashToken, verifyTokenHash } from "./password.service";

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
