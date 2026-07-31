import type { Request, Response } from "express";
import * as productService from "../services/product.service";
import { createProductSchema, updateProductSchema } from "../validation/product.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createProductSchema.parse(req.body);
  const product = await productService.createProduct(orgId, input);
  sendSuccess(res, product, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const products = await productService.listProducts(orgId);
  sendSuccess(res, products);
}

export async function update(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = updateProductSchema.parse(req.body);
  const product = await productService.updateProduct(orgId, req.params.productId!, input);
  sendSuccess(res, product);
}

export async function deactivate(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const product = await productService.deactivateProduct(orgId, req.params.productId!);
  sendSuccess(res, product);
}
