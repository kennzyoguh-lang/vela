import * as credentialRepo from "../repositories/payment-credential.repository";
import { encryptSecret, decryptSecret } from "../lib/encryption";
import { env } from "../lib/env";
import { NotFoundError } from "../lib/errors";
import type { PaymentProcessor } from "@prisma/client";

// AAD binds each ciphertext to its own [orgId, processor] pair — the same
// row-binding purpose as twofa.service.ts's per-user AAD, just keyed by two
// fields since a credential is scoped to (org, processor), not a single id.
function aad(orgId: string, processor: PaymentProcessor): string {
  return `${orgId}:${processor}`;
}

function requireEncryptionKey(): string {
  if (!env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64) {
    throw new Error(
      "Payment credential encryption is not configured — bring-your-own payment processor is unavailable until PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64 is set",
    );
  }
  return env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64;
}

export interface PaymentCredentialSummary {
  id: string;
  processor: PaymentProcessor;
  publicKey: string | null;
  isActive: boolean;
  updatedAt: Date;
}

/**
 * F-connectors — an org bringing their own Paystack/Stripe/Flutterwave
 * merchant account so customer payments settle directly into it instead of
 * Vela's own platform account. The secret is encrypted before it ever
 * touches the database (lib/encryption.ts) and is never read back out
 * through any HTTP response — listConnections/getConnection below only
 * ever return publicKey, never secretKeyEncrypted or its decrypted form.
 */
export async function connect(
  orgId: string,
  processor: PaymentProcessor,
  secretKey: string,
  publicKey?: string,
): Promise<PaymentCredentialSummary> {
  const key = requireEncryptionKey();
  const secretKeyEncrypted = encryptSecret(secretKey, key, aad(orgId, processor));
  const saved = await credentialRepo.upsert(orgId, processor, secretKeyEncrypted, publicKey);
  return {
    id: saved.id,
    processor: saved.processor,
    publicKey: saved.publicKey,
    isActive: saved.isActive,
    updatedAt: saved.updatedAt,
  };
}

export async function listConnections(orgId: string): Promise<PaymentCredentialSummary[]> {
  const rows = await credentialRepo.listByOrg(orgId);
  return rows.map((row) => ({
    id: row.id,
    processor: row.processor,
    publicKey: row.publicKey,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  }));
}

export async function disconnect(orgId: string, processor: PaymentProcessor): Promise<void> {
  await credentialRepo.deactivate(orgId, processor);
}

/**
 * Internal only — never exposed through any controller. Resolves the
 * secret key a payment for this org+processor should actually be signed/
 * verified with: the org's own bring-your-own key if they've connected one,
 * Vela's own platform key otherwise. This is the ONE place that decision
 * gets made, so payment-portal.controller.ts (initiating a charge) and
 * payment-webhook.service.ts (verifying one) can never disagree about
 * which key applies to a given org.
 *
 * orgId may be null — payment-webhook.service.ts doesn't know which org a
 * webhook belongs to until it's peeked the reference field and looked up
 * the invoice; if that lookup fails (unknown/malformed reference), there is
 * by definition no org-specific credential to prefer, so this falls
 * straight through to the platform default, exactly as if no org had ever
 * been identified.
 */
export async function resolveSecretKey(
  orgId: string | null,
  processor: PaymentProcessor,
): Promise<string | null> {
  if (orgId) {
    const credential = await credentialRepo.findByOrgAndProcessor(orgId, processor);
    if (credential) {
      const key = requireEncryptionKey();
      return decryptSecret(credential.secretKeyEncrypted, key, aad(orgId, processor));
    }
  }

  // Platform fallback — Vela's own account for this processor.
  if (processor === "paystack") return env.PAYSTACK_SECRET_KEY ?? null;
  return null; // flutterwave/stripe have no platform key today (stub gateways)
}

/**
 * Same resolution as resolveSecretKey, but throws instead of returning null
 * — for call sites (initiating a real charge) where "no key available at
 * all" is a hard stop, not a case to handle gracefully.
 */
export async function requireSecretKey(
  orgId: string,
  processor: PaymentProcessor,
): Promise<string> {
  const key = await resolveSecretKey(orgId, processor);
  if (!key) {
    throw new NotFoundError(
      `No ${processor} credentials configured for this organisation or Vela's own platform`,
    );
  }
  return key;
}
