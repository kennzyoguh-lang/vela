import { env } from "../../lib/env";
import type { BankSyncGatewayHandler, ExchangeLinkTokenResult, RawBankTransaction } from "./types";

const MONO_API_BASE = "https://api.withmono.com/v2";

interface MonoAccountResponse {
  account: {
    id: string;
    accountNumber: string;
    name: string;
    currency: string;
    type: string;
    institution: { name: string };
  };
  balance: number; // kobo
}

interface MonoTransaction {
  _id: string;
  amount: number; // kobo
  type: "credit" | "debit";
  narration: string;
  date: string;
}

interface MonoPaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; previous: number | null; next: number | null };
}

function requireSecretKey(): string {
  if (!env.MONO_SECRET_KEY) {
    throw new Error(
      "MONO_SECRET_KEY is not configured — create a Mono sandbox account and set the test secret key to enable bank sync",
    );
  }
  return env.MONO_SECRET_KEY;
}

function authHeaders(): Record<string, string> {
  return { "mono-sec-key": requireSecretKey(), "Content-Type": "application/json" };
}

/**
 * BRD-equivalent primary bank-sync provider for Nigeria (mirrors Paystack's
 * role for payments). MONO_SECRET_KEY unset means link/sync fail loudly at
 * the call site (Handbook 1.4), never at boot — same pattern as
 * payment-gateways/paystack.gateway.ts.
 */
export const monoGateway: BankSyncGatewayHandler = {
  provider: "mono",

  async exchangeLinkToken(code: string): Promise<ExchangeLinkTokenResult> {
    const authRes = await fetch(`${MONO_API_BASE}/accounts/auth`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ code }),
    });
    const authBody = (await authRes.json()) as { id?: string; message?: string };
    if (!authRes.ok || !authBody.id) {
      throw new Error(`Mono account linking failed: ${authBody.message ?? authRes.statusText}`);
    }

    const detailRes = await fetch(`${MONO_API_BASE}/accounts/${authBody.id}`, {
      headers: authHeaders(),
    });
    const detail = (await detailRes.json()) as MonoAccountResponse;
    if (!detailRes.ok) {
      throw new Error(`Mono account lookup failed: ${detailRes.statusText}`);
    }

    return {
      providerAccountId: detail.account.id,
      institutionName: detail.account.institution.name,
      accountType: detail.account.type,
      accountNumberMasked: detail.account.accountNumber.replace(/\d(?=\d{4})/g, "*"),
      currency: detail.account.currency,
    };
  },

  async fetchBalance(providerAccountId: string): Promise<number> {
    const res = await fetch(`${MONO_API_BASE}/accounts/${providerAccountId}`, {
      headers: authHeaders(),
    });
    const body = (await res.json()) as MonoAccountResponse;
    if (!res.ok) throw new Error(`Mono balance fetch failed: ${res.statusText}`);
    return body.balance / 100; // kobo -> Naira
  },

  async fetchTransactions(providerAccountId: string, since?: Date): Promise<RawBankTransaction[]> {
    const params = new URLSearchParams();
    if (since) params.set("start", since.toISOString().slice(0, 10));

    const transactions: RawBankTransaction[] = [];
    let page = 1;
    for (;;) {
      params.set("page", String(page));
      const res = await fetch(
        `${MONO_API_BASE}/accounts/${providerAccountId}/transactions?${params.toString()}`,
        { headers: authHeaders() },
      );
      const body = (await res.json()) as MonoPaginatedResponse<MonoTransaction>;
      if (!res.ok) throw new Error(`Mono transaction fetch failed: ${res.statusText}`);

      transactions.push(
        ...body.data.map((t) => ({
          providerTransactionId: t._id,
          type: t.type,
          amount: t.amount / 100, // kobo -> Naira
          narration: t.narration,
          transactionDate: new Date(t.date),
        })),
      );

      if (!body.meta.next) break;
      page = body.meta.next;
    }
    return transactions;
  },
};
