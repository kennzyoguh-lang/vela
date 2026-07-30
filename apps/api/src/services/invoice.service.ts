import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import type { InvoiceStatus } from "@prisma/client";
import type { CreateInvoiceInput, QuickCreateInvoiceInput } from "../validation/invoice.schema";
import type { PageParams } from "../lib/pagination";

/**
 * The invoice status-transition state machine (Handbook 16.1) — transitions
 * not in this map are rejected with BUSINESS_RULE_VIOLATION (Handbook 7.7),
 * e.g. a Paid invoice can never transition back to Draft, and nothing
 * transitions out of a terminal state (paid, written_off, void).
 */
const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "void"],
  viewed: ["partially_paid", "paid", "overdue", "void"],
  partially_paid: ["paid", "overdue"],
  overdue: ["paid", "partially_paid", "written_off", "void"],
  paid: [],
  written_off: [],
  void: [],
};

function assertTransitionAllowed(from: InvoiceStatus, to: InvoiceStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new BusinessRuleViolationError(`Cannot transition invoice from "${from}" to "${to}"`);
  }
}

export async function createInvoice(orgId: string, input: CreateInvoiceInput) {
  const client = await clientRepo.findById(orgId, input.clientId);
  if (!client) throw new NotFoundError("Client not found");

  const subtotal = input.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const total = subtotal + input.tax - input.discount;

  return invoiceRepo.createInvoice(orgId, {
    clientId: input.clientId,
    lineItems: input.lineItems,
    subtotal,
    tax: input.tax,
    discount: input.discount,
    total,
    currency: input.currency,
    dueDate: input.dueDate,
    notes: input.notes,
  });
}

// Design System 5.7's 3-field quick-create — a single line item named after
// the invoice itself, full editor (line items/tax/discount) reached from the
// detail view afterwards, never demanded upfront.
export async function quickCreateInvoice(orgId: string, input: QuickCreateInvoiceInput) {
  const client = await clientRepo.findById(orgId, input.clientId);
  if (!client) throw new NotFoundError("Client not found");

  return invoiceRepo.createInvoice(orgId, {
    clientId: input.clientId,
    lineItems: [{ description: "Services rendered", quantity: 1, unitPrice: input.amount }],
    subtotal: input.amount,
    tax: 0,
    discount: 0,
    total: input.amount,
    currency: input.currency,
    dueDate: input.dueDate,
  });
}

export async function getInvoice(orgId: string, invoiceId: string) {
  const invoice = await invoiceRepo.findById(orgId, invoiceId);
  if (!invoice) throw new NotFoundError("Invoice not found");
  return invoice;
}

export async function listInvoices(
  orgId: string,
  status: InvoiceStatus | undefined,
  page: PageParams,
) {
  return invoiceRepo.listByOrg(orgId, { status }, page);
}

export async function sendInvoice(orgId: string, invoiceId: string) {
  const invoice = await getInvoice(orgId, invoiceId);
  assertTransitionAllowed(invoice.status, "sent");
  return invoiceRepo.updateStatus(orgId, invoiceId, "sent", { sentAt: new Date() });
}

export async function markViewed(orgId: string, invoiceId: string) {
  const invoice = await getInvoice(orgId, invoiceId);
  if (invoice.status !== "sent") return invoice; // idempotent — only "sent" advances to "viewed"
  assertTransitionAllowed(invoice.status, "viewed");
  return invoiceRepo.updateStatus(orgId, invoiceId, "viewed", { viewedAt: new Date() });
}

export async function markPaid(orgId: string, invoiceId: string) {
  const invoice = await getInvoice(orgId, invoiceId);
  assertTransitionAllowed(invoice.status, "paid");
  const updated = await invoiceRepo.updateStatus(orgId, invoiceId, "paid", { paidAt: new Date() });

  // Feeds the risk-scoring model's "avg days late" input (Epic 3) — recorded
  // here since this is the one place a payment's actual timing is known.
  const daysLate = Math.max(
    0,
    Math.floor((updated.paidAt!.getTime() - updated.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const client = await clientRepo.findById(orgId, updated.clientId);
  if (client) {
    const previousAvg = client.avgPaymentDays ?? daysLate;
    const newAvg = previousAvg * 0.7 + daysLate * 0.3; // exponential moving average, not a full recompute
    await clientRepo.updateAvgPaymentDays(orgId, client.id, newAvg);
  }

  return updated;
}

export async function markOverdue(orgId: string, invoiceId: string) {
  const invoice = await getInvoice(orgId, invoiceId);
  if (!ALLOWED_TRANSITIONS[invoice.status].includes("overdue")) return invoice; // idempotent no-op
  return invoiceRepo.updateStatus(orgId, invoiceId, "overdue");
}

export async function voidInvoice(orgId: string, invoiceId: string, reason: string) {
  const invoice = await getInvoice(orgId, invoiceId);
  assertTransitionAllowed(invoice.status, "void");
  return invoiceRepo.updateStatus(orgId, invoiceId, "void", { voidedReason: reason });
}
