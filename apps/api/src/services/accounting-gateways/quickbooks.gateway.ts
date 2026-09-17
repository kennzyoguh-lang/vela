import { env } from "../../lib/env";
import type {
  AccountingGatewayHandler,
  AccountingConnectionTokens,
  RefreshedAccountingTokens,
  PushableInvoice,
} from "./types";

type PushInvoiceTokens = Pick<AccountingConnectionTokens, "accessToken" | "externalTenantId">;

// QuickBooks Online API v3 (Intuit Developer). Sandbox base URL — swapping to
// https://quickbooks.api.intuit.com for production is a config change, not a
// code change, once a real app has gone through Intuit's app review.
const QBO_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_API_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";
const QBO_SCOPE = "com.intuit.quickbooks.accounting";

interface QboTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
}

interface QboQueryResponse<T> {
  QueryResponse?: Record<string, T[]>;
}

interface QboCustomer {
  Id: string;
}

interface QboInvoice {
  Id: string;
}

function basicAuthHeader(): string {
  return (
    "Basic " +
    Buffer.from(`${env.QUICKBOOKS_CLIENT_ID}:${env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64")
  );
}

async function apiRequest<T>(
  realmId: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${QBO_API_BASE}/${realmId}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`QuickBooks API request failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// QBO invoice lines require an ItemRef (its catalog is products/services,
// not free text) — Vela has no equivalent catalog concept for a one-way
// export, so every pushed line references one shared "Vela Sales" service
// item, created once per connected company on first push, with the real
// description carried in the line's own Description field. This is the
// standard pattern third-party systems use when exporting to QBO without
// mirroring its chart of accounts.
async function ensureDefaultItem(realmId: string, accessToken: string): Promise<string> {
  const query = "SELECT Id FROM Item WHERE Name = 'Vela Sales' MAXRESULTS 1";
  const found = await apiRequest<QboQueryResponse<{ Id: string }>>(
    realmId,
    accessToken,
    `query?query=${encodeURIComponent(query)}`,
  );
  const existing = found.QueryResponse?.Item?.[0];
  if (existing) return existing.Id;

  const incomeAccountQuery = "SELECT Id FROM Account WHERE AccountType = 'Income' MAXRESULTS 1";
  const accountResult = await apiRequest<QboQueryResponse<{ Id: string }>>(
    realmId,
    accessToken,
    `query?query=${encodeURIComponent(incomeAccountQuery)}`,
  );
  const incomeAccount = accountResult.QueryResponse?.Account?.[0];
  if (!incomeAccount) {
    throw new Error("QuickBooks company has no Income account to attach the default sales item to");
  }

  const created = await apiRequest<{ Item: { Id: string } }>(realmId, accessToken, "item", {
    method: "POST",
    body: JSON.stringify({
      Name: "Vela Sales",
      Type: "Service",
      IncomeAccountRef: { value: incomeAccount.Id },
    }),
  });
  return created.Item.Id;
}

async function ensureCustomer(
  realmId: string,
  accessToken: string,
  clientName: string,
  clientEmail?: string | null,
): Promise<string> {
  const escapedName = clientName.replace(/'/g, "''");
  const query = `SELECT Id FROM Customer WHERE DisplayName = '${escapedName}' MAXRESULTS 1`;
  const found = await apiRequest<QboQueryResponse<QboCustomer>>(
    realmId,
    accessToken,
    `query?query=${encodeURIComponent(query)}`,
  );
  const existing = found.QueryResponse?.Customer?.[0];
  if (existing) return existing.Id;

  const created = await apiRequest<{ Customer: QboCustomer }>(realmId, accessToken, "customer", {
    method: "POST",
    body: JSON.stringify({
      DisplayName: clientName,
      PrimaryEmailAddr: clientEmail ? { Address: clientEmail } : undefined,
    }),
  });
  return created.Customer.Id;
}

export const quickbooksGateway: AccountingGatewayHandler = {
  provider: "quickbooks",

  isConfigured(): boolean {
    return Boolean(
      env.QUICKBOOKS_CLIENT_ID && env.QUICKBOOKS_CLIENT_SECRET && env.QUICKBOOKS_REDIRECT_URI,
    );
  },

  buildAuthorizeUrl(state: string): string {
    if (!this.isConfigured()) {
      throw new Error(
        "QuickBooks OAuth app is not configured (QUICKBOOKS_CLIENT_ID/SECRET/REDIRECT_URI)",
      );
    }
    const params = new URLSearchParams({
      client_id: env.QUICKBOOKS_CLIENT_ID!,
      redirect_uri: env.QUICKBOOKS_REDIRECT_URI!,
      response_type: "code",
      scope: QBO_SCOPE,
      state,
    });
    return `${QBO_AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCodeForTokens(
    code: string,
    callbackParams: Record<string, string>,
  ): Promise<AccountingConnectionTokens> {
    const realmId = callbackParams.realmId;
    if (!realmId) {
      throw new Error("QuickBooks callback did not include a realmId");
    }

    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.QUICKBOOKS_REDIRECT_URI ?? "",
      }),
    });
    if (!res.ok) {
      throw new Error(`QuickBooks token exchange failed: ${await res.text()}`);
    }
    const body = (await res.json()) as QboTokenResponse;

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      externalTenantId: realmId,
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<RefreshedAccountingTokens> {
    const res = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`QuickBooks token refresh failed: ${await res.text()}`);
    }
    const body = (await res.json()) as QboTokenResponse;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    };
  },

  async pushInvoice(tokens: PushInvoiceTokens, invoice: PushableInvoice): Promise<string> {
    const { accessToken, externalTenantId: realmId } = tokens;
    const [customerId, itemId] = await Promise.all([
      ensureCustomer(realmId, accessToken, invoice.clientName, invoice.clientEmail),
      ensureDefaultItem(realmId, accessToken),
    ]);

    const created = await apiRequest<{ Invoice: QboInvoice }>(realmId, accessToken, "invoice", {
      method: "POST",
      body: JSON.stringify({
        DocNumber: invoice.number,
        CustomerRef: { value: customerId },
        CurrencyRef: { value: invoice.currency },
        DueDate: invoice.dueDate.toISOString().slice(0, 10),
        TxnDate: invoice.issuedAt.toISOString().slice(0, 10),
        Line: invoice.lineItems.map((item) => ({
          Amount: item.quantity * item.unitPrice,
          DetailType: "SalesItemLineDetail",
          Description: item.description,
          SalesItemLineDetail: {
            ItemRef: { value: itemId },
            Qty: item.quantity,
            UnitPrice: item.unitPrice,
          },
        })),
      }),
    });
    return created.Invoice.Id;
  },
};
