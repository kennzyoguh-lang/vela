import * as clientRepo from "../repositories/client.repository";
import { NotFoundError } from "../lib/errors";
import type { CreateClientInput, UpdateClientInput } from "../validation/client.schema";
import type { PageParams } from "../lib/pagination";

export async function createClient(orgId: string, input: CreateClientInput) {
  return clientRepo.createClient(orgId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    paymentTerms: input.paymentTerms ?? 14,
  });
}

export async function getClient(orgId: string, clientId: string) {
  const client = await clientRepo.findById(orgId, clientId);
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function listClients(orgId: string, page: PageParams) {
  return clientRepo.listByOrg(orgId, page);
}

export async function updateClient(orgId: string, clientId: string, input: UpdateClientInput) {
  await getClient(orgId, clientId); // 404s before attempting the update
  return clientRepo.update(orgId, clientId, input);
}
