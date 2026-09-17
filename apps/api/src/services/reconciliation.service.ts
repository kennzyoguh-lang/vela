import * as bankTransactionRepo from "../repositories/bank-transaction.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as invoiceService from "./invoice.service";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import type { BankTransaction, Invoice } from "@prisma/client";

const SUGGESTION_WINDOW_DAYS = 90;
const MAX_CANDIDATES_PER_TRANSACTION = 5;
// A transfer landing exactly on the invoice amount is common practice in
// Nigeria (customers pay the stated total, not total-minus-bank-fees since
// transfer fees are typically charged to the sender separately) — a small
// tolerance still catches the odd kobo-rounding difference without
// suggesting matches for genuinely unrelated amounts.
const CLOSE_MATCH_TOLERANCE_FRACTION = 0.01;

export type MatchConfidence = "exact" | "close";

export interface InvoiceMatchCandidate {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string | null;
  total: number;
  dueDate: Date;
  confidence: MatchConfidence;
  daysFromDueDate: number;
}

export interface ReconciliationSuggestion {
  transactionId: string;
  amount: number;
  narration: string;
  transactionDate: Date;
  candidates: InvoiceMatchCandidate[];
}

function scoreCandidate(
  transaction: BankTransaction,
  invoice: Invoice,
): InvoiceMatchCandidate | null {
  const amount = Number(transaction.amount);
  const total = Number(invoice.total);
  if (total <= 0) return null;

  const diffFraction = Math.abs(amount - total) / total;
  let confidence: MatchConfidence;
  if (diffFraction === 0) {
    confidence = "exact";
  } else if (diffFraction <= CLOSE_MATCH_TOLERANCE_FRACTION) {
    confidence = "close";
  } else {
    return null;
  }

  const daysFromDueDate = Math.round(
    (transaction.transactionDate.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    clientId: invoice.clientId,
    total,
    dueDate: invoice.dueDate,
    confidence,
    daysFromDueDate,
  };
}

/**
 * Suggests, per unmatched incoming bank transaction, which of the org's own
 * unpaid invoices it most likely settled — a business that gets paid by
 * direct bank transfer (extremely common in Nigeria for B2B invoices, no
 * payment gateway involved at all) otherwise has no way to know its books
 * and its bank feed agree without manually cross-checking both by hand.
 * Suggests only; confirmMatch below is what actually records anything.
 */
export async function suggestMatches(orgId: string): Promise<ReconciliationSuggestion[]> {
  const since = new Date(Date.now() - SUGGESTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [transactions, invoices] = await Promise.all([
    bankTransactionRepo.listUnmatchedCredits(orgId, since),
    invoiceRepo.listUnpaid(orgId),
  ]);

  const suggestions: ReconciliationSuggestion[] = [];
  for (const transaction of transactions) {
    const candidates = invoices
      .map((invoice) => scoreCandidate(transaction, invoice))
      .filter((c): c is InvoiceMatchCandidate => c !== null)
      .sort((a, b) => {
        if (a.confidence !== b.confidence) return a.confidence === "exact" ? -1 : 1;
        return Math.abs(a.daysFromDueDate) - Math.abs(b.daysFromDueDate);
      })
      .slice(0, MAX_CANDIDATES_PER_TRANSACTION);

    if (candidates.length > 0) {
      suggestions.push({
        transactionId: transaction.id,
        amount: Number(transaction.amount),
        narration: transaction.narration,
        transactionDate: transaction.transactionDate,
        candidates,
      });
    }
  }

  return suggestions;
}

/**
 * Confirms a match: records it on the bank transaction AND marks the
 * invoice paid (invoice.service.ts#markPaid, which enforces its own status
 * transition rules) — the transaction is never the thing that silently
 * makes an invoice paid on its own; this is the one explicit call site
 * that does both together, always in response to a human confirming a
 * specific suggestion.
 */
export async function confirmMatch(
  orgId: string,
  transactionId: string,
  invoiceId: string,
): Promise<void> {
  const transaction = await bankTransactionRepo.findById(orgId, transactionId);
  if (!transaction) throw new NotFoundError("Bank transaction not found");
  if (transaction.type !== "credit") {
    throw new BusinessRuleViolationError(
      "Only incoming (credit) transactions can be matched to an invoice",
    );
  }
  if (transaction.matchedInvoiceId) {
    throw new BusinessRuleViolationError("This transaction is already matched to an invoice");
  }

  await invoiceService.markPaid(orgId, invoiceId);
  await bankTransactionRepo.matchToInvoice(orgId, transactionId, invoiceId);
}

/**
 * Clears the match on the bank-transaction side only — deliberately does
 * NOT revert the invoice back out of "paid" (Handbook 1.4-style "fail
 * safe, not fail silent": auto-unpaying an invoice as a side effect of
 * unmatching a transaction is exactly the kind of surprising, hard-to-audit
 * status change this codebase avoids elsewhere, e.g. markViewed's
 * forward-only transitions). An owner who matched the wrong transaction
 * corrects the invoice status separately if that's genuinely needed.
 */
export async function undoMatch(orgId: string, transactionId: string): Promise<void> {
  const transaction = await bankTransactionRepo.findById(orgId, transactionId);
  if (!transaction) throw new NotFoundError("Bank transaction not found");
  if (!transaction.matchedInvoiceId) {
    throw new BusinessRuleViolationError("This transaction isn't matched to an invoice");
  }
  await bankTransactionRepo.clearMatch(orgId, transactionId);
}
