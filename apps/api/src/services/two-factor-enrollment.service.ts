import * as userRepo from "../repositories/user.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import {
  generateTotpSecret,
  totpUri,
  verifyTotpCode,
  generateBackupCodes,
  consumeBackupCode,
  encryptTwoFaSecret,
} from "./twofa.service";
import { ValidationError } from "../lib/errors";

/** Orchestrates 2FA enrollment (repo + crypto) — the pure TOTP math stays in twofa.service.ts. */
export async function beginEnrollment(orgId: string, userId: string, email: string) {
  const secret = generateTotpSecret();
  return { secret, uri: totpUri(secret, email) };
}

export async function confirmEnrollment(
  orgId: string,
  userId: string,
  secret: string,
  code: string,
): Promise<{ backupCodes: string[] }> {
  if (!verifyTotpCode(secret, code)) {
    throw new ValidationError("Invalid verification code", "code");
  }
  const { plain, hashed } = await generateBackupCodes();
  await userRepo.setTwoFa(orgId, userId, {
    secretEncrypted: encryptTwoFaSecret(secret, userId),
    backupCodesHash: hashed,
  });
  await auditLogRepo.write({
    orgId,
    userId,
    action: "2fa.enabled",
    entityType: "user",
    entityId: userId,
  });
  return { backupCodes: plain };
}

export async function verifyBackupCode(
  orgId: string,
  userId: string,
  hashedCodes: string[],
  code: string,
): Promise<boolean> {
  const { matched, remaining } = await consumeBackupCode(code, hashedCodes);
  if (matched) {
    await userRepo.updateBackupCodes(orgId, userId, remaining);
    await auditLogRepo.write({
      orgId,
      userId,
      action: "2fa.backup_code_used",
      entityType: "user",
      entityId: userId,
    });
  }
  return matched;
}
