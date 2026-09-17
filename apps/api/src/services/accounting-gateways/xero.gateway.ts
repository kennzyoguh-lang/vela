import { env } from "../../lib/env";
import type {
  AccountingGatewayHandler,
  AccountingConnectionTokens,
  RefreshedAccountingTokens,
} from "./types";

// Xero's OAuth 2.0 endpoints — connecting works today (same shape as
// QuickBooks: authorization code + refresh token), but pushInvoice is not
// yet implemented (see the comment below) so the settings UI marks Xero
// "Coming soon" the same way it does Flutterwave/Stripe for payments,
// same reasoning: a connect flow with no working sync behind it would be
// worse than not offering it at all.
const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_SCOPE = "openid profile email accounting.transactions offline_access";

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface XeroConnection {
  tenantId: string;
}

function basicAuthHeader(): string {
  return (
    "Basic " + Buffer.from(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`).toString("base64")
  );
}

export const xeroGateway: AccountingGatewayHandler = {
  provider: "xero",

  isConfigured(): boolean {
    return Boolean(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET && env.XERO_REDIRECT_URI);
  },

  buildAuthorizeUrl(state: string): string {
    if (!this.isConfigured()) {
      throw new Error("Xero OAuth app is not configured (XERO_CLIENT_ID/SECRET/REDIRECT_URI)");
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.XERO_CLIENT_ID!,
      redirect_uri: env.XERO_REDIRECT_URI!,
      scope: XERO_SCOPE,
      state,
    });
    return `${XERO_AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string): Promise<AccountingConnectionTokens> {
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.XERO_REDIRECT_URI ?? "",
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Xero token exchange failed: ${await tokenRes.text()}`);
    }
    const tokens = (await tokenRes.json()) as XeroTokenResponse;

    // Xero identifies the connected company (tenantId) via a separate
    // "connections" call, not a callback query param like QuickBooks' realmId.
    const connectionsRes = await fetch("https://api.xero.com/connections", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!connectionsRes.ok) {
      throw new Error(`Xero connections lookup failed: ${await connectionsRes.text()}`);
    }
    const connections = (await connectionsRes.json()) as XeroConnection[];
    const tenantId = connections[0]?.tenantId;
    if (!tenantId) {
      throw new Error("Xero authorization completed but returned no connected tenant");
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      externalTenantId: tenantId,
    };
  },

  async refreshAccessToken(refreshToken: string): Promise<RefreshedAccountingTokens> {
    const res = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`Xero token refresh failed: ${await res.text()}`);
    }
    const body = (await res.json()) as XeroTokenResponse;
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    };
  },

  // Xero's invoice-push needs its own Contact/Account bootstrap (mirroring
  // quickbooks.gateway.ts's ensureCustomer/ensureDefaultItem against Xero's
  // different API shape) — deliberately not built until QuickBooks (the
  // more commonly requested provider) has proven the pattern against a real
  // sandbox account, per the "build the framework now, verify against real
  // credentials once available" scope this connector was approved under.
  async pushInvoice(): Promise<string> {
    throw new Error("Xero invoice push is not yet implemented");
  },
};
