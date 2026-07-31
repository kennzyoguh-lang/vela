import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import type { CreateQuickSaleInput } from "../validation/quick-sale.schema";

/**
 * Quick Sale / Instant Collect, Piece 1 — reuses Invoice as the underlying
 * record rather than a parallel model (see schema.prisma's InvoiceSource
 * comment): same paymentPortalToken, same /v1/pay/:token checkout, same
 * webhook handler, same TransactionMarkup fee logic, all completely
 * unmodified. clientId is null (no customer relationship at all) and status
 * starts at "sent" — there's no manual "send" step for an amount someone is
 * standing in front of the trader waiting to pay right now.
 */
export async function createQuickSale(orgId: string, actorId: string, input: CreateQuickSaleInput) {
  const invoice = await invoiceRepo.createInvoice(orgId, {
    clientId: null,
    lineItems: [{ description: "Quick Sale", quantity: 1, unitPrice: input.amount }],
    subtotal: input.amount,
    tax: 0,
    discount: 0,
    total: input.amount,
    currency: input.currency,
    dueDate: new Date(),
    status: "sent",
    source: "quick_sale",
  });

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "quick_sale.created",
    entityType: "invoice",
    entityId: invoice.id,
    newValue: { amount: input.amount, currency: input.currency },
  });

  return invoice;
}
