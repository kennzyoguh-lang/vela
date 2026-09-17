import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { AccountingProvider } from "@prisma/client";

export async function findByInvoiceAndProvider(
  orgId: string,
  invoiceId: string,
  provider: AccountingProvider,
): Promise<{ id: string; externalId: string } | null> {
  return withOrgScope(orgId, (tx) =>
    tx.invoiceAccountingSync.findFirst({
      where: { invoiceId, provider },
      select: { id: true, externalId: true },
    }),
  );
}

export async function record(
  orgId: string,
  invoiceId: string,
  provider: AccountingProvider,
  externalId: string,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.invoiceAccountingSync.create({
      data: { id: randomUUID(), orgId, invoiceId, provider, externalId },
    }),
  );
}

// Invoices this org has sent/paid that haven't yet been pushed to this
// specific provider — the one-way push job's actual work queue for one
// (org, provider) pair. status in [sent, paid] mirrors the "one-way push
// sync" decision: a draft invoice isn't real yet, and a void/written-off
// one was never meant to reach the customer's books either.
export async function listPushableInvoices(
  orgId: string,
  provider: AccountingProvider,
): Promise<
  {
    id: string;
    number: string;
    total: unknown;
    currency: string;
    dueDate: Date;
    createdAt: Date;
    lineItems: unknown;
    client: { name: string; email: string | null } | null;
  }[]
> {
  return withOrgScope(orgId, (tx) =>
    tx.invoice.findMany({
      where: {
        orgId,
        status: { in: ["sent", "paid"] },
        accountingSyncs: { none: { provider } },
      },
      select: {
        id: true,
        number: true,
        total: true,
        currency: true,
        dueDate: true,
        createdAt: true,
        lineItems: true,
        client: { select: { name: true, email: true } },
      },
    }),
  );
}
