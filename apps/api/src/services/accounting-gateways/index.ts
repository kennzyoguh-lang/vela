import type { AccountingProvider } from "@prisma/client";
import type { AccountingGatewayHandler } from "./types";
import { quickbooksGateway } from "./quickbooks.gateway";
import { xeroGateway } from "./xero.gateway";
import { waveGateway } from "./wave.gateway";

const gateways: Record<AccountingProvider, AccountingGatewayHandler> = {
  quickbooks: quickbooksGateway,
  xero: xeroGateway,
  wave: waveGateway,
};

export function getAccountingGateway(provider: AccountingProvider): AccountingGatewayHandler {
  return gateways[provider];
}

export type { AccountingGatewayHandler } from "./types";
export type {
  AccountingConnectionTokens,
  RefreshedAccountingTokens,
  PushableInvoice,
  PushableInvoiceLineItem,
} from "./types";
