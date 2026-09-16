import { randomUUID } from "node:crypto";
import { prisma, withOrgScope } from "../lib/prisma";
import type { Quote, QuoteStatus, Prisma } from "@prisma/client";
import { toPage, type Page, type PageParams } from "../lib/pagination";

export interface CreateQuoteData {
  clientId: string;
  lineItems: unknown;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  validUntil: Date;
  notes?: string;
}

// Mirrors invoice.repository.ts#nextInvoiceNumber exactly — same race-safe
// atomic upsert-and-increment shape, own counter table/prefix.
async function nextQuoteNumber(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ next: number }[]>`
    INSERT INTO quote_number_counters (org_id, next) VALUES (${orgId}::uuid, 2)
    ON CONFLICT (org_id) DO UPDATE SET next = quote_number_counters.next + 1
    RETURNING next
  `;
  const assigned = rows[0]!.next - 1;
  return `QUO-${String(assigned).padStart(4, "0")}`;
}

export async function createQuote(orgId: string, input: CreateQuoteData): Promise<Quote> {
  return withOrgScope(orgId, async (tx) => {
    const number = await nextQuoteNumber(tx, orgId);
    return tx.quote.create({
      data: {
        id: randomUUID(),
        orgId,
        number,
        clientId: input.clientId,
        lineItems: input.lineItems as Prisma.InputJsonValue,
        subtotal: input.subtotal,
        tax: input.tax,
        discount: input.discount,
        total: input.total,
        currency: input.currency,
        validUntil: input.validUntil,
        notes: input.notes,
        portalToken: randomUUID(),
      },
    });
  });
}

export async function findById(orgId: string, quoteId: string): Promise<Quote | null> {
  return withOrgScope(orgId, (tx) => tx.quote.findFirst({ where: { id: quoteId, orgId } }));
}

// Public quote portal lookup — mirrors invoice.repository.ts#findByPaymentPortalToken's
// two-step shape exactly (see resolve_org_for_quote_token's migration comment).
export async function findByPortalToken(token: string): Promise<Quote | null> {
  const rows = await prisma.$queryRaw<{ resolve_org_for_quote_token: string | null }[]>`
    SELECT resolve_org_for_quote_token(${token})
  `;
  const orgId = rows[0]?.resolve_org_for_quote_token;
  if (!orgId) return null;
  return withOrgScope(orgId, (tx) => tx.quote.findFirst({ where: { portalToken: token, orgId } }));
}

export async function listByOrg(
  orgId: string,
  filter: { status?: QuoteStatus } = {},
  page: PageParams,
): Promise<Page<Quote>> {
  const where = { orgId, ...(filter.status ? { status: filter.status } : {}) };
  return withOrgScope(orgId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.quote.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
      }),
      tx.quote.count({ where }),
    ]);
    return toPage(items, total, page);
  });
}

export async function updateStatus(
  orgId: string,
  quoteId: string,
  status: QuoteStatus,
  extra: Partial<{ sentAt: Date; respondedAt: Date; declineReason: string }> = {},
): Promise<Quote> {
  return withOrgScope(orgId, (tx) =>
    tx.quote.update({ where: { id: quoteId, orgId }, data: { status, ...extra } }),
  );
}

export async function setConvertedInvoiceId(
  orgId: string,
  quoteId: string,
  invoiceId: string,
): Promise<Quote> {
  return withOrgScope(orgId, (tx) =>
    tx.quote.update({ where: { id: quoteId, orgId }, data: { convertedInvoiceId: invoiceId } }),
  );
}
