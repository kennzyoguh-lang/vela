import * as quoteRepo from "../repositories/quote.repository";
import * as clientRepo from "../repositories/client.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as emailGateway from "./email/email.gateway";
import { quoteSentEmail } from "../email/templates/quote-sent";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import type { Invoice, Quote, QuoteStatus } from "@prisma/client";
import type { CreateQuoteInput, QuickCreateQuoteInput } from "../validation/quote.schema";
import type { PageParams } from "../lib/pagination";

// Mirrors invoice.service.ts's state machine exactly (Handbook 7.7,
// BUSINESS_RULE_VIOLATION on any transition not listed here) — a quote's
// lifecycle is simpler than an invoice's (no partial payment, no reissue):
// draft -> sent -> one of accepted/declined/expired, then terminal.
const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

function assertTransitionAllowed(from: QuoteStatus, to: QuoteStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new BusinessRuleViolationError(`Cannot transition quote from "${from}" to "${to}"`);
  }
}

export async function createQuote(orgId: string, input: CreateQuoteInput): Promise<Quote> {
  const client = await clientRepo.findById(orgId, input.clientId);
  if (!client) throw new NotFoundError("Client not found");

  const subtotal = input.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const total = subtotal + input.tax - input.discount;

  return quoteRepo.createQuote(orgId, {
    clientId: input.clientId,
    lineItems: input.lineItems,
    subtotal,
    tax: input.tax,
    discount: input.discount,
    total,
    currency: input.currency,
    validUntil: input.validUntil,
    notes: input.notes,
  });
}

// Mirrors invoice.service.ts#quickCreateInvoice's 3-field flow exactly (see
// quote.schema.ts's quickCreateQuoteSchema comment for why).
export async function quickCreateQuote(
  orgId: string,
  input: QuickCreateQuoteInput,
): Promise<Quote> {
  const client = await clientRepo.findById(orgId, input.clientId);
  if (!client) throw new NotFoundError("Client not found");

  return quoteRepo.createQuote(orgId, {
    clientId: input.clientId,
    lineItems: [{ description: "Services rendered", quantity: 1, unitPrice: input.amount }],
    subtotal: input.amount,
    tax: 0,
    discount: 0,
    total: input.amount,
    currency: input.currency,
    validUntil: input.validUntil,
  });
}

export async function getQuote(orgId: string, quoteId: string): Promise<Quote> {
  const quote = await quoteRepo.findById(orgId, quoteId);
  if (!quote) throw new NotFoundError("Quote not found");
  return quote;
}

export async function listQuotes(orgId: string, status: QuoteStatus | undefined, page: PageParams) {
  return quoteRepo.listByOrg(orgId, { status }, page);
}

/**
 * F-57 — marks the quote sent AND emails the client their view/respond link,
 * same "the status transition always succeeds, a delivery failure is logged
 * but never rolled back" contract as invoice.service.ts#sendInvoice
 * (Handbook 1.4).
 */
export async function sendQuote(orgId: string, quoteId: string): Promise<Quote> {
  const quote = await getQuote(orgId, quoteId);
  assertTransitionAllowed(quote.status, "sent");
  const updated = await quoteRepo.updateStatus(orgId, quoteId, "sent", { sentAt: new Date() });

  const client = await clientRepo.findById(orgId, updated.clientId);
  if (client?.email) {
    try {
      const organisation = await organisationRepo.findOrganisationById(orgId);
      const viewUrl = `${env.WEB_APP_URL}/quote/${updated.portalToken}`;
      const { subject, html, text } = quoteSentEmail({
        clientName: client.name,
        orgName: organisation?.name ?? "your supplier",
        quoteNumber: updated.number,
        total: Number(updated.total),
        currency: updated.currency,
        validUntil: updated.validUntil,
        viewUrl,
      });
      await emailGateway.sendEmail(client.email, subject, text, html);
    } catch (err) {
      logger.error({ err, orgId, quoteId }, "Failed to send quote-sent email to client");
    }
  } else {
    logger.info({ orgId, quoteId }, "Quote marked sent — client has no email on file");
  }

  return updated;
}

// Public quote-portal read (no auth — see quote.repository.ts#findByPortalToken).
export async function getPublicQuote(token: string): Promise<Quote> {
  const quote = await quoteRepo.findByPortalToken(token);
  if (!quote) throw new NotFoundError("Quote not found");
  return quote;
}

// Public accept, driven by the client's own click on the portal link — no
// auth context, so callers resolve orgId via getPublicQuote(token) first.
export async function acceptQuote(orgId: string, quoteId: string): Promise<Quote> {
  const quote = await getQuote(orgId, quoteId);
  assertTransitionAllowed(quote.status, "accepted");
  return quoteRepo.updateStatus(orgId, quoteId, "accepted", { respondedAt: new Date() });
}

export async function declineQuote(
  orgId: string,
  quoteId: string,
  reason?: string,
): Promise<Quote> {
  const quote = await getQuote(orgId, quoteId);
  assertTransitionAllowed(quote.status, "declined");
  return quoteRepo.updateStatus(orgId, quoteId, "declined", {
    respondedAt: new Date(),
    declineReason: reason,
  });
}

export async function markExpired(orgId: string, quoteId: string): Promise<Quote> {
  const quote = await getQuote(orgId, quoteId);
  if (!ALLOWED_TRANSITIONS[quote.status].includes("expired")) return quote; // idempotent no-op
  return quoteRepo.updateStatus(orgId, quoteId, "expired");
}

// Backs jobs/quote-expiry.job.ts's daily scan — same "one org per call,
// idempotent no-op via markExpired's own ALLOWED_TRANSITIONS check" shape
// as invoice.service.ts#markAllOverdue.
export async function markAllExpired(orgId: string): Promise<number> {
  const expirable = await quoteRepo.listExpirable(orgId, new Date());
  for (const quote of expirable) {
    await markExpired(orgId, quote.id);
  }
  return expirable.length;
}

/**
 * F-57 — turns an accepted quote into a real Invoice, copying its
 * commercial terms verbatim (line items/subtotal/tax/discount/total/client/
 * currency). Due date defaults to the client's own payment-terms window
 * from today (invoice.repository.ts has no "copy from quote" concept to
 * reuse — Invoice's dueDate is a due-by date, unrelated to the quote's own
 * validUntil, which is now moot once accepted). Recorded on the quote via
 * convertedInvoiceId so the UI can link forward to it; only ever called
 * once per quote (an invoice already linked is a business-rule violation,
 * not a silent no-op, since converting twice would double-bill the client).
 */
export async function convertToInvoice(orgId: string, quoteId: string): Promise<Invoice> {
  const quote = await getQuote(orgId, quoteId);
  if (quote.status !== "accepted") {
    throw new BusinessRuleViolationError("Only an accepted quote can be converted to an invoice");
  }
  if (quote.convertedInvoiceId) {
    throw new BusinessRuleViolationError("Quote has already been converted to an invoice");
  }

  const client = await clientRepo.findById(orgId, quote.clientId);
  if (!client) throw new NotFoundError("Client not found");

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + client.paymentTerms);

  const invoice = await invoiceRepo.createInvoice(orgId, {
    clientId: quote.clientId,
    lineItems: quote.lineItems,
    subtotal: Number(quote.subtotal),
    tax: Number(quote.tax),
    discount: Number(quote.discount),
    total: Number(quote.total),
    currency: quote.currency,
    dueDate,
    notes: quote.notes ?? undefined,
  });

  await quoteRepo.setConvertedInvoiceId(orgId, quoteId, invoice.id);
  return invoice;
}
