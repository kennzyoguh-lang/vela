import type { Request, Response } from "express";
import * as saleService from "../services/sale.service";
import { createSaleSchema } from "../validation/sale.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";

export async function create(req: Request, res: Response) {
  const { orgId, userId, role } = getAuthContext(req);
  const input = createSaleSchema.parse(req.body);
  const sale = await saleService.logSale(orgId, userId, role, input);
  sendSuccess(res, sale, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const sales = await saleService.listSales(orgId, parsePageParams(req));
  sendSuccess(res, sales);
}
