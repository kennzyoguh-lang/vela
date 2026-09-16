import type { Request, Response } from "express";
import * as clientRepo from "../repositories/client.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as quoteService from "../services/quote.service";
import { declineQuoteSchema } from "../validation/quote.schema";
import { sendSuccess } from "../lib/response";

/**
 * Standalone public page, no login — mirrors payment-portal.controller.ts's
 * #getPublicInvoice exactly. The client viewing the quote has no
 * authenticated org context, so getPublicQuote resolves it via the
 * resolve_org_for_quote_token SECURITY DEFINER function first.
 */
export async function getPublicQuote(req: Request, res: Response) {
  const quote = await quoteService.getPublicQuote(req.params.token!);
  const [client, organisation] = await Promise.all([
    clientRepo.findById(quote.orgId, quote.clientId),
    organisationRepo.findOrganisationById(quote.orgId),
  ]);

  sendSuccess(res, {
    number: quote.number,
    total: quote.total,
    subtotal: quote.subtotal,
    tax: quote.tax,
    discount: quote.discount,
    currency: quote.currency,
    validUntil: quote.validUntil,
    status: quote.status,
    lineItems: quote.lineItems,
    notes: quote.notes,
    businessName: organisation?.name,
    clientName: client?.name,
  });
}

export async function accept(req: Request, res: Response) {
  const quote = await quoteService.getPublicQuote(req.params.token!);
  const updated = await quoteService.acceptQuote(quote.orgId, quote.id);
  sendSuccess(res, updated);
}

export async function decline(req: Request, res: Response) {
  const quote = await quoteService.getPublicQuote(req.params.token!);
  const { reason } = declineQuoteSchema.parse(req.body);
  const updated = await quoteService.declineQuote(quote.orgId, quote.id, reason);
  sendSuccess(res, updated);
}
