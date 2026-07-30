import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";

export type RiskBand = "low" | "medium" | "high";

export interface RiskScoreInputs {
  /** Client's historical average days late paying past invoices (null = no history yet). */
  avgPaymentDays: number | null;
  /** Days the invoice has been outstanding past its due date (0 if not yet due). */
  daysOutstanding: number;
  /** Invoice total, in the org's base currency, for the amount-weighting factor. */
  amount: number;
}

// Weight ceilings per factor — sum to 100. Handbook 16.1: "starts as a simple
// weighted-feature model, not a full ML pipeline" — each factor's ceiling and
// normalization constant is a documented, tunable business decision, not a
// derived statistic, until enough real payment data exists to justify more.
const PAYMENT_HISTORY_MAX = 60;
const AGE_MAX = 25;
const AMOUNT_MAX = 15;

const PAYMENT_HISTORY_NORMALIZATION_DAYS = 30; // 30+ days average lateness maxes this factor
const AGE_NORMALIZATION_DAYS = 14; // 14+ days outstanding maxes this factor
const LARGE_INVOICE_THRESHOLD = 1_000_000; // NGN — maxes the amount factor

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pure function — no I/O, deterministic, unit-tested at every band boundary
 * (Handbook 12.3's banding-boundary discipline, the same rigor Foundation
 * applied to withOrgScope's UUID check). Never called with a DB connection in
 * scope; scoreInvoiceRisk below handles fetching the inputs and persisting
 * the result.
 */
export function calculateRiskScore(inputs: RiskScoreInputs): number {
  const paymentHistoryScore =
    inputs.avgPaymentDays === null
      ? PAYMENT_HISTORY_MAX / 2 // no history yet — neutral, not zero (an unknown client isn't automatically low-risk)
      : clamp(
          (inputs.avgPaymentDays / PAYMENT_HISTORY_NORMALIZATION_DAYS) * PAYMENT_HISTORY_MAX,
          0,
          PAYMENT_HISTORY_MAX,
        );

  const ageScore = clamp((inputs.daysOutstanding / AGE_NORMALIZATION_DAYS) * AGE_MAX, 0, AGE_MAX);

  const amountScore = clamp((inputs.amount / LARGE_INVOICE_THRESHOLD) * AMOUNT_MAX, 0, AMOUNT_MAX);

  return Math.round(clamp(paymentHistoryScore + ageScore + amountScore, 0, 100));
}

// Design System 4.25: never a bare number in the UI — always the labelled
// Low/Medium/High dot-scale. Boundaries match this service's own tests.
export function riskBand(score: number): RiskBand {
  if (score > 66) return "high";
  if (score >= 34) return "medium";
  return "low";
}

export async function scoreInvoice(orgId: string, invoiceId: string): Promise<number> {
  const invoice = await invoiceRepo.findById(orgId, invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found for org ${orgId}`);
  const client = await clientRepo.findById(orgId, invoice.clientId);

  const daysOutstanding = Math.max(
    0,
    Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const score = calculateRiskScore({
    avgPaymentDays: client?.avgPaymentDays ?? null,
    daysOutstanding,
    amount: parseFloat(invoice.total.toString()),
  });

  await invoiceRepo.updateRiskScore(orgId, invoiceId, score);
  return score;
}

// Recalculated daily via a scheduled job (Epic 4's job runner), not
// per-request — Handbook 16.1: "a slow-changing signal, not a real-time one."
export async function scoreAllOpenInvoices(orgId: string): Promise<void> {
  const openInvoices = await invoiceRepo.listAllByOrg(orgId);
  for (const invoice of openInvoices) {
    if (["paid", "written_off", "void"].includes(invoice.status)) continue;
    await scoreInvoice(orgId, invoice.id);
  }
}
