import type { AccountingProvider } from "@prisma/client";
import * as connectionRepo from "../repositories/accounting-connection.repository";
import * as syncRepo from "../repositories/invoice-accounting-sync.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { getAccountingGateway } from "./accounting-gateways";
import type { PushableInvoice } from "./accounting-gateways/types";
import { encryptSecret, decryptSecret } from "../lib/encryption";
import { signAccountingOAuthState, verifyAccountingOAuthState } from "./jwt.service";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { ConflictError } from "../lib/errors";

// AAD binds each ciphertext to its own [orgId, provider] pair — same
// row-binding purpose as payment-credential.service.ts's aad().
function aad(orgId: string, provider: AccountingProvider): string {
  return `${orgId}:${provider}`;
}

function requireEncryptionKey(): string {
  if (!env.ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64) {
    throw new Error(
      "Accounting connection encryption is not configured — set ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64",
    );
  }
  return env.ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64;
}

export interface AccountingConnectionSummary {
  id: string;
  provider: AccountingProvider;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date;
}

export function isProviderConfigured(provider: AccountingProvider): boolean {
  return getAccountingGateway(provider).isConfigured();
}

/**
 * Step 1 of the OAuth handshake — the URL the frontend redirects the
 * browser to. The signed state token (jwt.service.ts) is what lets
 * handleCallback below trust which org this connection belongs to, since
 * the provider's own redirect back to Vela carries no auth header at all.
 */
export function getAuthorizeUrl(orgId: string, provider: AccountingProvider): string {
  const gateway = getAccountingGateway(provider);
  if (!gateway.isConfigured()) {
    throw new ConflictError(`${provider} is not available yet — check back soon`);
  }
  const state = signAccountingOAuthState({ sub: orgId, provider });
  return gateway.buildAuthorizeUrl(state);
}

/**
 * Step 2 — the provider's redirect back to Vela after the business owner
 * approves the connection in QuickBooks/Xero's own UI. Returns the orgId
 * resolved from the state token so the (public, unauthenticated) controller
 * knows which web-app URL to redirect the browser to next.
 */
export async function handleCallback(
  provider: AccountingProvider,
  code: string,
  state: string,
  callbackParams: Record<string, string>,
): Promise<{ orgId: string }> {
  const claims = verifyAccountingOAuthState(state);
  if (claims.provider !== provider) {
    throw new ConflictError("OAuth state does not match the callback provider");
  }
  const orgId = claims.sub;

  const gateway = getAccountingGateway(provider);
  const tokens = await gateway.exchangeCodeForTokens(code, callbackParams);
  const key = requireEncryptionKey();

  const saved = await connectionRepo.upsert(orgId, provider, {
    externalTenantId: tokens.externalTenantId,
    accessTokenEncrypted: encryptSecret(tokens.accessToken, key, aad(orgId, provider)),
    refreshTokenEncrypted: encryptSecret(tokens.refreshToken, key, aad(orgId, provider)),
    tokenExpiresAt: tokens.expiresAt,
  });

  // No authenticated Express request exists on this public callback route
  // to attach auditLog middleware to (Handbook 5.7) — written directly here
  // instead, same "connecting an external account is security-sensitive"
  // reasoning as payment-credential.routes.ts's auditLog on connect.
  await auditLogRepo.write({
    orgId,
    action: "accounting_connection.connect",
    entityType: "accounting_connection",
    entityId: saved.id,
  });

  return { orgId };
}

export async function listConnections(orgId: string): Promise<AccountingConnectionSummary[]> {
  const rows = await connectionRepo.listByOrg(orgId);
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    isActive: row.isActive,
    lastSyncedAt: row.lastSyncedAt,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt,
  }));
}

export async function disconnect(orgId: string, provider: AccountingProvider): Promise<void> {
  await connectionRepo.deactivate(orgId, provider);
}

/**
 * Returns a valid (non-expired) access token for this connection, silently
 * refreshing and persisting the new token pair first if the current one is
 * at or past expiry. Internal only — the push job is the sole caller.
 */
async function getValidAccessToken(
  connectionId: string,
  orgId: string,
  provider: AccountingProvider,
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string,
  tokenExpiresAt: Date,
): Promise<string> {
  const key = requireEncryptionKey();
  // A minute of slack so a token that expires mid-request never gets used.
  if (tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(accessTokenEncrypted, key, aad(orgId, provider));
  }

  const refreshToken = decryptSecret(refreshTokenEncrypted, key, aad(orgId, provider));
  const gateway = getAccountingGateway(provider);
  const refreshed = await gateway.refreshAccessToken(refreshToken);

  await connectionRepo.updateTokens(
    connectionId,
    orgId,
    encryptSecret(refreshed.accessToken, key, aad(orgId, provider)),
    encryptSecret(refreshed.refreshToken, key, aad(orgId, provider)),
    refreshed.expiresAt,
  );

  return refreshed.accessToken;
}

/**
 * The one-way push itself — every not-yet-synced sent/paid invoice for one
 * (org, provider) connection. Called by accounting-push.job.ts once per
 * active connection; a failure here is recorded on the connection
 * (lastSyncError, surfaced in the settings UI) and never thrown further,
 * since one org's misconfigured connection must never block the rest of
 * the daily batch (same "continue with the rest" contract as
 * quote-expiry.job.ts).
 */
export async function pushPendingInvoices(
  orgId: string,
  provider: AccountingProvider,
): Promise<number> {
  const connection = await connectionRepo.findByOrgAndProvider(orgId, provider);
  if (!connection) return 0;

  const gateway = getAccountingGateway(provider);
  let pushedCount = 0;

  try {
    const accessToken = await getValidAccessToken(
      connection.id,
      orgId,
      provider,
      connection.accessTokenEncrypted,
      connection.refreshTokenEncrypted,
      connection.tokenExpiresAt,
    );

    const invoices = await syncRepo.listPushableInvoices(orgId, provider);
    for (const invoice of invoices) {
      try {
        const pushable: PushableInvoice = {
          number: invoice.number,
          clientName: invoice.client?.name ?? "Walk-in customer",
          clientEmail: invoice.client?.email ?? null,
          currency: invoice.currency,
          total: Number(invoice.total),
          lineItems:
            (invoice.lineItems as { description: string; quantity: number; unitPrice: number }[]) ??
            [],
          dueDate: invoice.dueDate,
          issuedAt: invoice.createdAt,
        };
        const externalId = await gateway.pushInvoice(
          { accessToken, externalTenantId: connection.externalTenantId },
          pushable,
        );
        await syncRepo.record(orgId, invoice.id, provider, externalId);
        pushedCount++;
      } catch (err) {
        logger.error(
          { orgId, provider, invoiceId: invoice.id, err },
          "Accounting push failed for one invoice — continuing with the rest of this org's batch",
        );
      }
    }

    await connectionRepo.recordSyncResult(connection.id, orgId, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ orgId, provider, err }, "Accounting push failed for connection");
    await connectionRepo.recordSyncResult(connection.id, orgId, message);
  }

  return pushedCount;
}
