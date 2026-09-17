import type { Request, Response } from "express";
import * as credentialService from "../services/payment-credential.service";
import {
  connectPaymentCredentialSchema,
  disconnectPaymentCredentialParamsSchema,
} from "../validation/payment-credential.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function connect(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const input = connectPaymentCredentialSchema.parse(req.body);
  const result = await credentialService.connect(
    orgId,
    input.processor,
    input.secretKey,
    input.publicKey,
  );
  sendSuccess(res, result, 201);
}

export async function list(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const connections = await credentialService.listConnections(orgId);
  sendSuccess(res, connections);
}

export async function disconnect(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { processor } = disconnectPaymentCredentialParamsSchema.parse(req.params);
  await credentialService.disconnect(orgId, processor);
  sendSuccess(res, { disconnected: true });
}
