import type { Request, Response } from "express";
import * as clientService from "../services/client.service";
import { createClientSchema, updateClientSchema } from "../validation/client.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { parsePageParams } from "../lib/pagination";

export async function create(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = createClientSchema.parse(req.body);
  const client = await clientService.createClient(orgId, input);
  sendSuccess(res, client, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const clients = await clientService.listClients(orgId, parsePageParams(req));
  sendSuccess(res, clients);
}

export async function getOne(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const client = await clientService.getClient(orgId, req.params.clientId!);
  sendSuccess(res, client);
}

export async function update(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = updateClientSchema.parse(req.body);
  const client = await clientService.updateClient(orgId, req.params.clientId!, input);
  sendSuccess(res, client);
}
