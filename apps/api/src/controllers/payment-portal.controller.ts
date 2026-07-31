import type { Request, Response } from "express";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as invoiceService from "../services/invoice.service";
import { getGateway } from "../services/payment-gateways";
import { initiatePaymentSchema } from "../validation/payment-portal.schema";
import { sendSuccess } from "../lib/response";
import { NotFoundError } from "../lib/errors";
import { env } from "../lib/env";

/**
 * Design System 6.13: standalone public page, no login. The invoice lookup
 * goes through invoiceRepo.findByPaymentPortalToken, which resolves org_id
 * via the resolve_org_for_payment_token SECURITY DEFINER function before
 * falling back to the normal withOrgScope path — there is no authenticated
 * org context here at all (Foundation's login-by-email problem, same shape).
 */
export async function getPublicInvoice(req: Request, res: Response) {
  const invoice = await invoiceRepo.findByPaymentPortalToken(req.params.token!);
  if (!invoice) throw new NotFoundError("Invoice not found");

  // Quick Sale invoices have no client — skip the lookup entirely rather
  // than passing null into a repo function typed for a real id.
  const [client, organisation] = await Promise.all([
    invoice.clientId ? clientRepo.findById(invoice.orgId, invoice.clientId) : null,
    organisationRepo.findOrganisationById(invoice.orgId),
  ]);

  // Marks Sent -> Viewed the first time the payer opens the link (Handbook 16.1's state machine).
  await invoiceService.markViewed(invoice.orgId, invoice.id);

  sendSuccess(res, {
    number: invoice.number,
    total: invoice.total,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    status: invoice.status,
    lineItems: invoice.lineItems,
    businessName: organisation?.name,
    clientName: client?.name,
    isQuickSale: invoice.source === "quick_sale",
  });
}

// F-71: the WhatsApp-shareable link is this exact URL — no separate mechanism.
export async function initiatePayment(req: Request, res: Response) {
  const invoice = await invoiceRepo.findByPaymentPortalToken(req.params.token!);
  if (!invoice) throw new NotFoundError("Invoice not found");
  if (invoice.status === "paid") {
    // Revisiting an already-paid link shows the receipt state, never a
    // payable form again (Design System 6.13 — double-payment prevention as UX).
    sendSuccess(res, { alreadyPaid: true });
    return;
  }

  const { payerEmail } = initiatePaymentSchema.parse(req.body);
  const gateway = getGateway("paystack");

  const result = await gateway.initializePayment({
    reference: invoice.paymentPortalToken,
    amount: parseFloat(invoice.total.toString()),
    currency: invoice.currency,
    payerEmail,
    callbackUrl: `${env.WEB_APP_URL}/pay/${invoice.paymentPortalToken}`,
  });

  sendSuccess(res, { checkoutUrl: result.checkoutUrl });
}
