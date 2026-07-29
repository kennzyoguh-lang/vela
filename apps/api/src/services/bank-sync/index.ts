import type { BankSyncProvider } from "@prisma/client";
import type { BankSyncGatewayHandler } from "./types";
import { monoGateway } from "./mono.gateway";
import { okraGateway } from "./okra.gateway";

const registry: Record<BankSyncProvider, BankSyncGatewayHandler> = {
  mono: monoGateway,
  okra: okraGateway,
};

export function getBankSyncGateway(provider: BankSyncProvider): BankSyncGatewayHandler {
  return registry[provider];
}

export type { BankSyncGatewayHandler, ExchangeLinkTokenResult, RawBankTransaction } from "./types";
