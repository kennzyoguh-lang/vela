import type { BankSyncProvider } from "@prisma/client";

export interface ExchangeLinkTokenResult {
  providerAccountId: string;
  institutionName: string;
  accountType: string;
  accountNumberMasked: string;
  currency: string;
}

export interface RawBankTransaction {
  providerTransactionId: string;
  type: "credit" | "debit";
  amount: number; // major currency unit (Naira, not kobo) — handlers convert internally
  narration: string;
  transactionDate: Date;
}

/**
 * Mirrors payment-gateways/types.ts's PaymentGatewayHandler shape — same
 * interface-plus-registry pattern so a second provider (Okra) plugs in
 * without touching call sites (Handbook 10.3).
 */
export interface BankSyncGatewayHandler {
  readonly provider: BankSyncProvider;
  /** Exchanges the Connect widget's one-time code for a linked account. */
  exchangeLinkToken(code: string): Promise<ExchangeLinkTokenResult>;
  fetchBalance(providerAccountId: string): Promise<number>;
  fetchTransactions(providerAccountId: string, since?: Date): Promise<RawBankTransaction[]>;
}
