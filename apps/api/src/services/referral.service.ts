import { randomBytes } from "node:crypto";
import * as referralCodeRepo from "../repositories/referral-code.repository";
import * as referralConversionRepo from "../repositories/referral-conversion.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import { logger } from "../lib/logger";

// Avoids visually-ambiguous characters (0/O, 1/I/L) since this is read aloud
// and typed by hand, not copy-pasted — same reasoning as staff PIN
// generation elsewhere in this codebase.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

function generateCandidateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

// Find-or-create — an org only ever has one code (see referral-code.
// repository.ts's comment on why this isn't a DB-level constraint). A code
// collision across orgs is astronomically unlikely at this alphabet/length
// (32^7), but retried on the off chance a unique-violation happens anyway.
export async function getOrCreateCode(orgId: string): Promise<string> {
  const existing = await referralCodeRepo.findByOrg(orgId);
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await referralCodeRepo.create(orgId, generateCandidateCode());
      return created.code;
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
        continue; // code collision — try another
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique referral code after 5 attempts");
}

export interface ResolvedReferral {
  orgId: string;
  codeId: string;
}

// Public — no org context required. Used by the /refer/[code] landing page
// (validate a code exists before showing the signup CTA) and by
// auth.service.ts#signup (resolve the code the visitor arrived with into
// the two ids stored on the new Organisation row).
export async function resolveCode(code: string): Promise<ResolvedReferral | null> {
  return referralCodeRepo.resolveCode(code);
}

const REWARD_DESCRIPTION =
  "1 month free — accrued, applied automatically once subscription billing launches";

/**
 * Called from payment-webhook.service.ts at the exact point invoice
 * markPaid + recordMarkup already fire (Handbook 5.9's single idempotent
 * webhook-processing point) — never awaited by anything upstream of that,
 * and never allowed to fail the webhook response. Reads the referee org's
 * own referredByOrgId/referredByCodeId (set once at signup, never changed)
 * rather than needing any cross-org lookup here. The referee-org unique
 * constraint on referral_conversions is what actually makes this safe to
 * call on every paid invoice, not just the first — every call after the
 * first silently no-ops.
 */
export async function recordConversionIfReferred(
  refereeOrgId: string,
  conversionEvent: "invoice_paid" | "quick_sale_paid",
): Promise<void> {
  const refereeOrg = await organisationRepo.findOrganisationById(refereeOrgId);
  if (!refereeOrg?.referredByOrgId || !refereeOrg.referredByCodeId) return;

  const converted = await referralConversionRepo.recordConversion({
    orgId: refereeOrg.referredByOrgId,
    refereeOrgId,
    referralCodeId: refereeOrg.referredByCodeId,
    conversionEvent,
    rewardDescription: REWARD_DESCRIPTION,
  });

  if (converted) {
    logger.info(
      { referrerOrgId: refereeOrg.referredByOrgId, refereeOrgId, conversionEvent },
      "Referral converted — reward accrued",
    );
  }
}

export type ReferralTier = "bronze" | "silver" | "gold" | "platinum";

// Computed on read from the conversion count, never stored — same
// "derive, don't cache" precedent as tax-status.service.ts's status field.
// Starting thresholds; revisit once real referral volume exists.
export function tierForConversionCount(count: number): ReferralTier {
  if (count >= 25) return "platinum";
  if (count >= 10) return "gold";
  if (count >= 3) return "silver";
  return "bronze";
}

export interface ReferralSummary {
  code: string;
  conversionCount: number;
  tier: ReferralTier;
  rewardsDescription: string[];
}

export async function getSummary(orgId: string): Promise<ReferralSummary> {
  // Sequential, not Promise.all — each of these opens its own withOrgScope
  // transaction, and firing two at once against the same org raced for a
  // slot in Prisma's connection pool and timed out (P2028 "Unable to start
  // a transaction in the given time") under real network latency to
  // Supabase, caught live during this channel's verification. Neither call
  // depends on the other's result; this is purely about not contending for
  // the pool.
  const code = await getOrCreateCode(orgId);
  const conversions = await referralConversionRepo.listByOrg(orgId);

  return {
    code,
    conversionCount: conversions.length,
    tier: tierForConversionCount(conversions.length),
    rewardsDescription: conversions.map((c) => c.rewardDescription),
  };
}
