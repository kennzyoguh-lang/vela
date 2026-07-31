import type { Request, Response } from "express";
import * as quickSaleService from "../services/quick-sale.service";
import { createQuickSaleSchema } from "../validation/quick-sale.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function create(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const input = createQuickSaleSchema.parse(req.body);
  const invoice = await quickSaleService.createQuickSale(orgId, userId, input);
  sendSuccess(res, invoice, 201);
}
