import { env } from "../lib/env";
import { logger } from "../lib/logger";

const MINDEE_EXPENSE_RECEIPT_ENDPOINT =
  "https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict";

export interface ExtractedReceiptData {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null; // "YYYY-MM-DD"
}

interface MindeePredictionField<T> {
  value: T | null;
}

interface MindeeExpenseReceiptResponse {
  document?: {
    inference?: {
      prediction?: {
        supplier_name?: MindeePredictionField<string>;
        total_amount?: MindeePredictionField<number>;
        date?: MindeePredictionField<string>;
        locale?: { currency?: string | null };
      };
    };
  };
}

/**
 * Whether Vela's own side of the OCR integration is configured — not
 * whether OCR will succeed for any given receipt. Handbook 1.4: a missing
 * developer-account credential (no MINDEE_API_KEY exists yet) must never
 * block the underlying action it augments — a receipt still uploads and
 * stores fine (stored-file.repository.ts) whether or not OCR can run; this
 * only gates the "auto-fill the form for you" convenience on top of it.
 */
export function isConfigured(): boolean {
  return Boolean(env.MINDEE_API_KEY);
}

/**
 * Extracts vendor/amount/currency/date from a receipt image via Mindee's
 * Expense Receipts API. Returns null (never throws) when OCR isn't
 * configured or the call itself fails — a failed scan degrades to manual
 * entry, it never blocks the receipt upload that triggered it.
 */
export async function extractReceiptData(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ExtractedReceiptData | null> {
  if (!isConfigured()) return null;

  try {
    const form = new FormData();
    form.append("document", new Blob([fileBuffer], { type: mimeType }), filename);

    const res = await fetch(MINDEE_EXPENSE_RECEIPT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Token ${env.MINDEE_API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "Mindee receipt OCR request failed");
      return null;
    }

    const body = (await res.json()) as MindeeExpenseReceiptResponse;
    const prediction = body.document?.inference?.prediction;
    if (!prediction) return null;

    return {
      vendor: prediction.supplier_name?.value ?? null,
      amount: prediction.total_amount?.value ?? null,
      currency: prediction.locale?.currency ?? null,
      date: prediction.date?.value ?? null,
    };
  } catch (err) {
    logger.error({ err }, "Mindee receipt OCR request threw");
    return null;
  }
}
