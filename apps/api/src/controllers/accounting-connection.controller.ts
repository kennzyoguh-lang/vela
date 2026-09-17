import type { Request, Response } from "express";
import * as connectionService from "../services/accounting-connection.service";
import {
  accountingProviderParamsSchema,
  accountingCallbackQuerySchema,
} from "../validation/accounting-connection.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export async function getAuthorizeUrl(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { provider } = accountingProviderParamsSchema.parse(req.params);
  const url = connectionService.getAuthorizeUrl(orgId, provider);
  sendSuccess(res, { url });
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const connections = await connectionService.listConnections(orgId);
  sendSuccess(res, connections);
}

const ALL_PROVIDERS = ["quickbooks", "xero", "wave"] as const;

// Whether OUR side of each OAuth app is actually configured — depends on
// env vars set at deploy time, not something the frontend should hardcode
// (unlike PaymentConnectorsCard's `live` flag, which tracks whether the
// gateway code itself is finished, not a runtime credential).
export async function listProviderAvailability(_req: Request, res: Response) {
  const availability = ALL_PROVIDERS.map((provider) => ({
    provider,
    configured: connectionService.isProviderConfigured(provider),
  }));
  sendSuccess(res, availability);
}

export async function disconnect(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { provider } = accountingProviderParamsSchema.parse(req.params);
  await connectionService.disconnect(orgId, provider);
  sendSuccess(res, { disconnected: true });
}

// Public — the provider redirects the business owner's own browser straight
// here after they approve the connection on QuickBooks/Xero's own consent
// screen, with no Vela auth header attached at all. Always ends in a
// redirect back to the web app rather than a JSON response, since a real
// browser navigation (not an API call) is what lands here.
export async function callback(req: Request, res: Response) {
  const { provider } = accountingProviderParamsSchema.parse(req.params);
  const redirectBase = `${env.WEB_APP_URL}/settings/integrations`;

  const parsedQuery = accountingCallbackQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.redirect(`${redirectBase}?accounting=error&provider=${provider}`);
    return;
  }
  const { code, state, ...rest } = parsedQuery.data;

  try {
    await connectionService.handleCallback(provider, code, state, rest as Record<string, string>);
    res.redirect(`${redirectBase}?accounting=connected&provider=${provider}`);
  } catch (err) {
    logger.error({ provider, err }, "Accounting connection callback failed");
    res.redirect(`${redirectBase}?accounting=error&provider=${provider}`);
  }
}
