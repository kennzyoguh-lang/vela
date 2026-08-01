import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as smsGateway from "./sms/termii.gateway";
import { normalizePhoneNumber } from "../lib/phone";
import { NotFoundError } from "../lib/errors";
import { env } from "../lib/env";
import type {
  CreateQuickSaleInput,
  SendQuickSalePaymentLinkSmsInput,
} from "../validation/quick-sale.schema";

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

// Mirrors owner-summary.service.ts's local formatNaira — no shared currency
// formatter exists on the API side (see that file's comment). Whole-naira,
// no decimals: this feeds a plain-language SMS sentence, not a financial
// document.
function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

/**
 * Quick Sale / Instant Collect Piece 4 — the trader taps "Send SMS" and
 * expects to know whether it actually worked, so a real Termii send failure
 * propagates to the caller (controller → 4xx/5xx → frontend's existing
 * "Could not send this — try again" alert) rather than being swallowed.
 * Termii itself still degrades to an honest "[stub] would send" log when
 * TERMII_API_KEY isn't configured (termii.gateway.ts), so this never blocks
 * development or a deployment without SMS credentials yet.
 */
export async function sendPaymentLinkSms(
  orgId: string,
  actorId: string,
  invoiceId: string,
  input: SendQuickSalePaymentLinkSmsInput,
) {
  const invoice = await invoiceRepo.findById(orgId, invoiceId);
  if (!invoice) throw new NotFoundError("Quick Sale not found");

  const phone = normalizePhoneNumber(input.phone);
  const payUrl = `${env.WEB_APP_URL}/pay/${invoice.paymentPortalToken}`;
  const message = `Pay ${formatNaira(Number(invoice.total))} now: ${payUrl}`;

  await smsGateway.sendSms(phone, message);

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "quick_sale.sms_sent",
    entityType: "invoice",
    entityId: invoice.id,
    newValue: { phone },
  });

  return { sent: true, message };
}
