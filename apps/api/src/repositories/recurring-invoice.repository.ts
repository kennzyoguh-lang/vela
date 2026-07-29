import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { RecurringInvoice, RecurringFrequency } from "@prisma/client";

export interface RecurringTemplateData {
  lineItems: unknown;
  tax: number;
  discount: number;
  currency: string;
  netDays: number; // due date = generation date + netDays
}

export async function create(
  orgId: string,
  input: {
    clientId: string;
    frequency: RecurringFrequency;
    nextSendDate: Date;
    templateData: RecurringTemplateData;
  },
): Promise<RecurringInvoice> {
  return withOrgScope(orgId, (tx) =>
    tx.recurringInvoice.create({
      data: {
        id: randomUUID(),
        orgId,
        clientId: input.clientId,
        frequency: input.frequency,
        nextSendDate: input.nextSendDate,
        templateData: input.templateData as never,
      },
    }),
  );
}

export async function listByOrg(orgId: string): Promise<RecurringInvoice[]> {
  return withOrgScope(orgId, (tx) => tx.recurringInvoice.findMany({ where: { orgId } }));
}

export async function listDue(orgId: string, asOfDate: Date): Promise<RecurringInvoice[]> {
  return withOrgScope(orgId, (tx) =>
    tx.recurringInvoice.findMany({
      where: { orgId, status: "active", nextSendDate: { lte: asOfDate } },
    }),
  );
}

export async function advanceSchedule(
  orgId: string,
  id: string,
  nextSendDate: Date,
  lastSentAt: Date,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.recurringInvoice.update({ where: { id, orgId }, data: { nextSendDate, lastSentAt } }),
  );
}

export async function setStatus(
  orgId: string,
  id: string,
  status: "active" | "paused" | "cancelled",
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.recurringInvoice.update({ where: { id, orgId }, data: { status } }),
  );
}
