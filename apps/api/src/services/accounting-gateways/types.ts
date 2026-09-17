import type { AccountingProvider } from "@prisma/client";

export interface AccountingConnectionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  externalTenantId: string;
}

export interface RefreshedAccountingTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface PushableInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PushableInvoice {
  number: string;
  clientName: string;
  clientEmail?: string | null;
  currency: string;
  total: number;
  lineItems: PushableInvoiceLineItem[];
  dueDate: Date;
  issuedAt: Date;
}

/**
 * F-connectors — one-way (Vela -> provider) invoice push to an accounting
 * app the org already uses. Every method that talks to the provider takes
 * the already-resolved token/tenant, exactly like PaymentGatewayHandler
 * takes an explicit secretKey — this module never reads env credentials
 * itself, so it can never disagree with accounting-connection.service.ts
 * (the one place token resolution and refresh happen) about which
 * credentials apply to a given org.
 */
export interface AccountingGatewayHandler {
  provider: AccountingProvider;

  /** Whether OUR side of the OAuth app is configured (client id/secret set) — not whether any org has connected. */
  isConfigured(): boolean;

  /** The URL to send the browser to begin the OAuth consent flow. */
  buildAuthorizeUrl(state: string): string;

  /**
   * Exchanges an authorization code for tokens. `callbackParams` carries
   * whatever extra fields the provider appended to its redirect (QuickBooks'
   * realmId, for instance) that aren't part of the OAuth 2.0 spec itself.
   */
  exchangeCodeForTokens(
    code: string,
    callbackParams: Record<string, string>,
  ): Promise<AccountingConnectionTokens>;

  refreshAccessToken(refreshToken: string): Promise<RefreshedAccountingTokens>;

  /** Pushes one invoice, returning the provider's own id for it. */
  pushInvoice(
    tokens: Pick<AccountingConnectionTokens, "accessToken" | "externalTenantId">,
    invoice: PushableInvoice,
  ): Promise<string>;
}
