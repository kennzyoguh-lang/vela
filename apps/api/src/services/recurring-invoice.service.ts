import * as recurringRepo from "../repositories/recurring-invoice.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import { NotFoundError } from "../lib/errors";
import type { RecurringFrequency } from "@prisma/client";
import type { RecurringTemplateData } from "../repositories/recurring-invoice.repository";
import type { LineItem } from "../validation/invoice.schema";

function advance(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  else next.setMonth(next.getMonth() + 3); // quarterly
  return next;
}

export async function createSchedule(
  orgId: string,
  input: {
    clientId: string;
    frequency: RecurringFrequency;
    startDate: Date;
    lineItems: LineItem[];
    tax: number;
    discount: number;
    currency: string;
    netDays: number;
  },
) {
  const client = await clientRepo.findById(orgId, input.clientId);
  if (!client) throw new NotFoundError("Client not found");

  const templateData: RecurringTemplateData = {
    lineItems: input.lineItems,
    tax: input.tax,
    discount: input.discount,
    currency: input.currency,
    netDays: input.netDays,
  };

  return recurringRepo.create(orgId, {
    clientId: input.clientId,
    frequency: input.frequency,
    nextSendDate: input.startDate,
    templateData,
  });
}

export async function pauseSchedule(orgId: string, id: string) {
  await recurringRepo.setStatus(orgId, id, "paused");
}

export async function resumeSchedule(orgId: string, id: string) {
  await recurringRepo.setStatus(orgId, id, "active");
}

export async function cancelSchedule(orgId: string, id: string) {
  await recurringRepo.setStatus(orgId, id, "cancelled");
}

export async function listSchedules(orgId: string) {
  return recurringRepo.listByOrg(orgId);
}

/**
 * Generates every recurring invoice due today for the org, advances each
 * schedule's next-send date, and returns how many were generated — called by
 * the job runner (jobs/recurring-invoice.job.ts), never per-request.
 */
export async function generateDueInvoices(orgId: string, now: Date): Promise<number> {
  const due = await recurringRepo.listDue(orgId, now);
  let generated = 0;

  for (const schedule of due) {
    const template = schedule.templateData as unknown as RecurringTemplateData;
    const lineItems = template.lineItems as LineItem[];
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const total = subtotal + template.tax - template.discount;

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + template.netDays);

    await invoiceRepo.createInvoice(orgId, {
      clientId: schedule.clientId,
      lineItems: template.lineItems,
      subtotal,
      tax: template.tax,
      discount: template.discount,
      total,
      currency: template.currency,
      dueDate,
    });

    await recurringRepo.advanceSchedule(
      orgId,
      schedule.id,
      advance(schedule.nextSendDate, schedule.frequency),
      now,
    );
    generated++;
  }

  return generated;
}
