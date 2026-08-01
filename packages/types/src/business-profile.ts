// Business profiling — three INDEPENDENT onboarding factors, each with a
// genuine third "unsure/mixed" state, drive per-module default visibility
// directly. Deliberately NOT a single informal/semi_formal/formal tier
// feeding an if/else chain: real businesses give mixed, sometimes
// contradictory signals across these three answers, and a single bucket
// can't represent that correctly (see the worked examples in
// business-profile.test.ts, especially Example 3 — a CAC-registered
// walk-in retail counter needs compliance tools AND has no staff to
// reconcile against; neither answer may suppress the other).
//
// The "profile label" computed below is a SEPARATE, secondary summary used
// only for notification-channel defaults and onboarding tone — it must
// never be the thing module visibility is derived from.

export type CustomerPattern = "one_time" | "repeat" | "unsure";
export type YesNoUnsure = "yes" | "no" | "unsure";

export interface BusinessProfileFactors {
  /** Factor A — "Do most of your customers pay once and leave, or come back regularly?" */
  customerPattern: CustomerPattern;
  /** Factor B — "Do you have staff who handle sales or cash?" */
  hasSalesStaff: YesNoUnsure;
  /** Factor C — "Is your business registered with CAC?" (the strongest formality signal) */
  isCacRegistered: YesNoUnsure;
}

export const UNANSWERED_BUSINESS_PROFILE_FACTORS: BusinessProfileFactors = {
  customerPattern: "unsure",
  hasSalesStaff: "unsure",
  isCacRegistered: "unsure",
};

export type ModuleKey =
  | "quickSale"
  | "invoicing"
  | "cashReconciliation"
  | "inventoryReorder"
  | "compliance"
  | "payroll"
  | "fullPnl"
  | "accountantPortal";

export const MODULE_KEYS: ModuleKey[] = [
  "quickSale",
  "invoicing",
  "cashReconciliation",
  "inventoryReorder",
  "compliance",
  "payroll",
  "fullPnl",
  "accountantPortal",
];

export type ModuleVisibility = Record<ModuleKey, boolean>;

/** A present key always wins over the computed default, in either direction. */
export type ModuleOverrides = Partial<Record<ModuleKey, boolean>>;

/**
 * Per-module DEFAULT visibility, computed directly from the three factors —
 * never from a single tier lookup. "Basic inventory" (the product catalog
 * itself) is deliberately absent from this map: it's always visible for
 * every business and has no gating factor, so there's nothing to compute.
 *
 * Every branch here is a direct transcription of the spec's module table —
 * do not "simplify" by routing through the profile label; Example 3 (a
 * CAC-registered one-time-sale retail counter with no staff) is exactly the
 * case that breaks if Factor A or B is allowed to influence a Factor-C-only
 * decision, or vice versa.
 */
export function computeModuleDefaults(factors: BusinessProfileFactors): ModuleVisibility {
  const oneTimeOrUnsure =
    factors.customerPattern === "one_time" || factors.customerPattern === "unsure";
  const repeatOrUnsure =
    factors.customerPattern === "repeat" || factors.customerPattern === "unsure";

  return {
    quickSale: oneTimeOrUnsure,
    invoicing: repeatOrUnsure,
    // Independent of A and C — a registered company with only the owner
    // handling sales still has nothing to reconcile against.
    cashReconciliation: factors.hasSalesStaff === "yes",
    inventoryReorder: repeatOrUnsure,
    // Factor C is the ONLY driver — never let A or B override it either way.
    compliance: factors.isCacRegistered === "yes",
    payroll: factors.isCacRegistered === "yes",
    // A semi-formal business with repeat customers and staff has real
    // bookkeeping needs even if not yet CAC-registered.
    fullPnl:
      factors.isCacRegistered === "yes" ||
      (factors.customerPattern === "repeat" && factors.hasSalesStaff === "yes"),
    accountantPortal: factors.isCacRegistered === "yes",
  };
}

/** Requirement 4 — visibility is always a default, never a hard restriction. */
export function applyModuleOverrides(
  defaults: ModuleVisibility,
  overrides: ModuleOverrides,
): ModuleVisibility {
  return { ...defaults, ...overrides };
}

export type AskVelaMode = "simplified" | "full";

/** Ask Vela is always visible; only its response mode changes with Factor C. */
export function computeAskVelaMode(factors: BusinessProfileFactors): AskVelaMode {
  return factors.isCacRegistered === "yes" ? "full" : "simplified";
}

export type ProfileLabel = "informal" | "semi_formal" | "formal";

/**
 * Secondary summary label — notification-channel defaults and onboarding
 * tone ONLY. Never import this into module-visibility logic.
 */
export function computeProfileLabel(factors: BusinessProfileFactors): ProfileLabel {
  const score =
    (factors.customerPattern === "repeat" ? 1 : 0) +
    (factors.hasSalesStaff === "yes" ? 1 : 0) +
    (factors.isCacRegistered === "yes" ? 1 : 0);
  if (score === 0) return "informal";
  if (score === 3) return "formal";
  return "semi_formal";
}

export type NotificationChannelDefault = "email" | "whatsapp_sms";

/**
 * Score 0 (informal) -> whatsapp_sms; 1-2 (semi_formal) and 3 (formal) ->
 * email. Factor C = "yes" forces email explicitly and first, rather than
 * relying on the score alone — under the current weights C=yes always
 * yields score >= 1 (never "informal") so this happens to already follow
 * from the score, but the spec calls for an explicit, direct guard here so
 * the invariant can't silently break if the scoring weights ever change.
 */
export function computeNotificationChannelDefault(
  factors: BusinessProfileFactors,
): NotificationChannelDefault {
  if (factors.isCacRegistered === "yes") return "email";
  return computeProfileLabel(factors) === "informal" ? "whatsapp_sms" : "email";
}
