import type { Request, Response } from "express";
import * as invoiceService from "../services/invoice.service";
import * as clientService from "../services/client.service";
import {
  createInvoiceSchema,
  quickCreateInvoiceSchema,
  voidInvoiceSchema,
} from "../validation/invoice.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";
import { renderInvoicePdf } from "../services/invoice-pdf.service";
import * as organisationRepo from "../repositories/organisation.repository";
import type { InvoiceStatus } from "@prisma/client";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.createInvoice(orgId, input);
  sendSuccess(res, invoice, 201);
}

export async function quickCreate(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = quickCreateInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.quickCreateInvoice(orgId, input);
  sendSuccess(res, invoice, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const status =
    typeof req.query.status === "string" ? (req.query.status as InvoiceStatus) : undefined;
  const invoices = await invoiceService.listInvoices(orgId, status, parsePageParams(req));
  sendSuccess(res, invoices);
}

export async function getOne(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const invoice = await invoiceService.getInvoice(orgId, req.params.invoiceId!);
  sendSuccess(res, invoice);
}

export async function send(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const invoice = await invoiceService.sendInvoice(orgId, req.params.invoiceId!);
  sendSuccess(res, invoice);
}

export async function markPaidManually(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const invoice = await invoiceService.markPaid(orgId, req.params.invoiceId!);
  sendSuccess(res, invoice);
}

export async function voidInvoice(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { reason } = voidInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.voidInvoice(orgId, req.params.invoiceId!, reason);
  sendSuccess(res, invoice);
}

export async function downloadPdf(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const invoice = await invoiceService.getInvoice(orgId, req.params.invoiceId!);
  const client = await clientService.getClient(orgId, invoice.clientId);
  const organisation = await organisationRepo.findOrganisationById(orgId);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${invoice.number}.pdf"`);
  const doc = renderInvoicePdf(invoice, client, organisation!);
  doc.pipe(res);
  doc.end();
}
