import type { Request, Response } from "express";
import * as saleService from "../services/sale.service";
import { createSaleSchema, voidSaleSchema } from "../validation/sale.schema";
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
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const sales = await saleService.listSales(orgId, parsePageParams(req), branchId);
  sendSuccess(res, sales);
}

export async function voidSale(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { reason } = voidSaleSchema.parse(req.body);
  const sale = await saleService.voidSale(orgId, req.params.saleId!, reason);
  sendSuccess(res, sale);
}
