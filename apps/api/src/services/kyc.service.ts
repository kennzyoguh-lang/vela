import * as kycRepo from "../repositories/kyc.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { encryptSecret } from "../lib/encryption";
import { env } from "../lib/env";
import { ValidationError } from "../lib/errors";

const NIN_PATTERN = /^\d{11}$/;
const BVN_PATTERN = /^\d{11}$/;

function requireEncryptionKey(): string {
  if (!env.KYC_ENCRYPTION_KEY_BASE64) {
    throw new Error("KYC encryption is not configured — set KYC_ENCRYPTION_KEY_BASE64");
  }
  return env.KYC_ENCRYPTION_KEY_BASE64;
}

export interface KycStatus {
  ninSubmitted: boolean;
  ninVerified: boolean;
  bvnSubmitted: boolean;
  bvnVerified: boolean;
}

/**
 * Never returns the NIN/BVN itself, encrypted or otherwise — same
 * write-only contract as a password. ninVerified/bvnVerified are always
 * false today: Vela has no NIMC or bank BVN-verification API credentials
 * yet (Handbook 1.4 — a missing developer-account credential blocks only
 * this one feature, never anything else), so "submitted" and "verified"
 * are deliberately kept as two separate booleans rather than one status
 * enum, so the settings UI can show an honest "on file, verification
 * pending" instead of silently claiming a check that never happened.
 */
export async function getStatus(orgId: string): Promise<KycStatus> {
  const kyc = await kycRepo.findByOrg(orgId);
  return {
    ninSubmitted: kyc?.ninSubmittedAt != null,
    ninVerified: kyc?.ninVerifiedAt != null,
    bvnSubmitted: kyc?.bvnSubmittedAt != null,
    bvnVerified: kyc?.bvnVerifiedAt != null,
  };
}

// AAD binds the ciphertext to this org — same row-binding purpose as
// payment-credential.service.ts's aad(), just keyed by orgId alone since
// there's exactly one NIN and one BVN per org (unlike a per-processor
// credential).
function aad(orgId: string, field: "nin" | "bvn"): string {
  return `${orgId}:${field}`;
}

export async function submitNin(orgId: string, nin: string): Promise<void> {
  if (!NIN_PATTERN.test(nin)) {
    throw new ValidationError("NIN must be exactly 11 digits", "nin");
  }
  const key = requireEncryptionKey();
  await kycRepo.upsertNin(orgId, encryptSecret(nin, key, aad(orgId, "nin")));

  await auditLogRepo.write({
    orgId,
    action: "kyc.nin_submitted",
    entityType: "organisation",
    entityId: orgId,
  });
}

export async function submitBvn(orgId: string, bvn: string): Promise<void> {
  if (!BVN_PATTERN.test(bvn)) {
    throw new ValidationError("BVN must be exactly 11 digits", "bvn");
  }
  const key = requireEncryptionKey();
  await kycRepo.upsertBvn(orgId, encryptSecret(bvn, key, aad(orgId, "bvn")));

  await auditLogRepo.write({
    orgId,
    action: "kyc.bvn_submitted",
    entityType: "organisation",
    entityId: orgId,
  });
}
