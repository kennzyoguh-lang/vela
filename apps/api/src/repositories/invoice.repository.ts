import { randomUUID } from "node:crypto";
import { prisma, withOrgScope } from "../lib/prisma";
import type { Invoice, InvoiceStatus, InvoiceSource, Prisma } from "@prisma/client";
import { toPage, type Page, type PageParams } from "../lib/pagination";

export interface CreateInvoiceData {
  // Nullable — a Quick Sale invoice has no client (see schema.prisma's
  // InvoiceSource comment). Every manual-invoice caller still always
  // supplies one.
  clientId: string | null;
  lineItems: unknown;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  dueDate: Date;
  notes?: string;
  // Both optional and Prisma-defaulted (draft / manual) — omitted by every
  // existing caller, set explicitly only by quick-sale.service.ts.
  status?: InvoiceStatus;
  source?: InvoiceSource;
}

/**
 * Assigns the next sequential invoice number for the org atomically, in the
 * same transaction as the invoice insert (Handbook: race-safe numbering).
 * The upsert always returns `next` post-increment; subtracting 1 gives the
 * number this invoice should use, whether the counter row was just created
 * (insert sets next=2, assigned=1) or already existed (update sets
 * next=N+1, assigned=N) — the same formula covers both paths.
 */
async function nextInvoiceNumber(tx: Prisma.TransactionClient, orgId: string): Promise<string> {
  const rows = await tx.$queryRaw<{ next: number }[]>`
    INSERT INTO invoice_number_counters (org_id, next) VALUES (${orgId}::uuid, 2)
    ON CONFLICT (org_id) DO UPDATE SET next = invoice_number_counters.next + 1
    RETURNING next
  `;
  const assigned = rows[0]!.next - 1;
  return `INV-${String(assigned).padStart(4, "0")}`;
}

export async function createInvoice(orgId: string, input: CreateInvoiceData): Promise<Invoice> {
  return withOrgScope(orgId, async (tx) => {
    const number = await nextInvoiceNumber(tx, orgId);
    return tx.invoice.create({
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
        dueDate: input.dueDate,
        notes: input.notes,
        status: input.status,
        source: input.source,
        paymentPortalToken: randomUUID(),
      },
    });
  });
}

export async function findById(orgId: string, invoiceId: string): Promise<Invoice | null> {
  return withOrgScope(orgId, (tx) => tx.invoice.findFirst({ where: { id: invoiceId, orgId } }));
}

/**
 * Public payment portal lookup (Design System 6.13, F-56) — the payer has no
 * session/org context at all, so a plain scoped query can't work (a fresh,
 * non-transactional query sees app.current_org_id as unset, and RLS's
 * `org_id = current_setting(...)` then matches nothing, ever). This resolves
 * the org_id via a narrow SECURITY DEFINER function
 * (resolve_org_for_payment_token, migrations/20260729010300) and then reads
 * the actual row through the normal withOrgScope path — the same two-step
 * shape as Foundation's login-by-email lookup, not a new bypass pattern.
 */
export async function findByPaymentPortalToken(token: string): Promise<Invoice | null> {
  const rows = await prisma.$queryRaw<{ resolve_org_for_payment_token: string | null }[]>`
    SELECT resolve_org_for_payment_token(${token})
  `;
  const orgId = rows[0]?.resolve_org_for_payment_token;
  if (!orgId) return null;
  return withOrgScope(orgId, (tx) =>
    tx.invoice.findFirst({ where: { paymentPortalToken: token, orgId } }),
  );
}

// Paginated — backs the HTTP list endpoint (GET /invoices) that a human
// scrolls through. Internal callers that need every matching invoice for a
// computation (reminder jobs, risk scoring, Ask Vela tools, the accountant
// dashboard summary) must use listAllByOrg below instead — silently
// truncating those to one page would produce wrong answers, not just a
// slow UI.
export async function listByOrg(
  orgId: string,
  filter: { status?: InvoiceStatus } = {},
  page: PageParams,
): Promise<Page<Invoice>> {
  const where = { orgId, ...(filter.status ? { status: filter.status } : {}) };
  return withOrgScope(orgId, async (tx) => {
    const [items, total] = await Promise.all([
      tx.invoice.findMany({ where, orderBy: { dueDate: "asc" }, skip: page.skip, take: page.take }),
      tx.invoice.count({ where }),
    ]);
    return toPage(items, total, page);
  });
}

export async function listAllByOrg(
  orgId: string,
  filter: { status?: InvoiceStatus } = {},
): Promise<Invoice[]> {
  return withOrgScope(orgId, (tx) =>
    tx.invoice.findMany({
      where: { orgId, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { dueDate: "asc" },
    }),
  );
}

export async function listOverdue(orgId: string, asOfDate: Date): Promise<Invoice[]> {
  return withOrgScope(orgId, (tx) =>
    tx.invoice.findMany({
      where: {
        orgId,
        status: { notIn: ["paid", "written_off", "void"] },
        dueDate: { lt: asOfDate },
      },
      orderBy: { dueDate: "asc" },
    }),
  );
}

export async function updateStatus(
  orgId: string,
  invoiceId: string,
  status: InvoiceStatus,
  extra: Partial<{
    sentAt: Date;
    viewedAt: Date;
    paidAt: Date;
    voidedReason: string;
    riskScore: number;
  }> = {},
): Promise<Invoice> {
  return withOrgScope(orgId, (tx) =>
    tx.invoice.update({ where: { id: invoiceId, orgId }, data: { status, ...extra } }),
  );
}

export async function updateRiskScore(
  orgId: string,
  invoiceId: string,
  riskScore: number,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.invoice.update({ where: { id: invoiceId, orgId }, data: { riskScore } }),
  );
}
