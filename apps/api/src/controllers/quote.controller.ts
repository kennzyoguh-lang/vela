import type { Request, Response } from "express";
import * as quoteService from "../services/quote.service";
import { createQuoteSchema, quickCreateQuoteSchema } from "../validation/quote.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";
import type { QuoteStatus } from "@prisma/client";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createQuoteSchema.parse(req.body);
  const quote = await quoteService.createQuote(orgId, input);
  sendSuccess(res, quote, 201);
}

export async function quickCreate(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = quickCreateQuoteSchema.parse(req.body);
  const quote = await quoteService.quickCreateQuote(orgId, input);
  sendSuccess(res, quote, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const status =
    typeof req.query.status === "string" ? (req.query.status as QuoteStatus) : undefined;
  const quotes = await quoteService.listQuotes(orgId, status, parsePageParams(req));
  sendSuccess(res, quotes);
}

export async function getOne(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const quote = await quoteService.getQuote(orgId, req.params.quoteId!);
  sendSuccess(res, quote);
}

export async function send(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const quote = await quoteService.sendQuote(orgId, req.params.quoteId!);
  sendSuccess(res, quote);
}

export async function convertToInvoice(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const invoice = await quoteService.convertToInvoice(orgId, req.params.quoteId!);
  sendSuccess(res, invoice, 201);
}
