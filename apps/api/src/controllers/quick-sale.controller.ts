import type { Request, Response } from "express";
import * as quickSaleService from "../services/quick-sale.service";
import {
  createQuickSaleSchema,
  sendQuickSalePaymentLinkSmsSchema,
} from "../validation/quick-sale.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function create(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = createQuickSaleSchema.parse(req.body);
  const invoice = await quickSaleService.createQuickSale(orgId, userId, input);
  sendSuccess(res, invoice, 201);
}

export async function sendSms(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = sendQuickSalePaymentLinkSmsSchema.parse(req.body);
  const result = await quickSaleService.sendPaymentLinkSms(orgId, userId, req.params.id!, input);
  sendSuccess(res, result);
}
