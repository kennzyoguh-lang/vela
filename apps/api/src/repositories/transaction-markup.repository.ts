import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { PaymentProcessor, TransactionMarkup } from "@prisma/client";

export async function create(
  orgId: string,
  input: {
    invoiceId: string;
    processor: PaymentProcessor;
    grossAmount: number;
    processorFee: number;
    velaMarkupPct: number;
    velaFeeAmount: number;
    currency: string;
    settledAt: Date;
  },
): Promise<TransactionMarkup> {
  return withOrgScope(orgId, (tx) =>
    tx.transactionMarkup.create({
      data: {
        id: randomUUID(),
        orgId,
        invoiceId: input.invoiceId,
        processor: input.processor,
        grossAmount: input.grossAmount,
        processorFee: input.processorFee,
        velaMarkupPct: input.velaMarkupPct,
        velaFeeAmount: input.velaFeeAmount,
        currency: input.currency,
        settledAt: input.settledAt,
      },
    }),
  );
}
