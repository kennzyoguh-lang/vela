import * as invoiceRepo from "../repositories/invoice.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { logger } from "../lib/logger";
import type { Invoice } from "@prisma/client";

export type ReminderTrigger = "due_in_7_days" | "due_today" | "overdue_3_days" | "overdue_7_days";

function daysUntil(dueDate: Date, now: Date): number {
  return Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * BRD F-04's fixed sequence — configurable per-org triggers are a later
 * refinement; this is the documented default. Pure function: given "now" and
 * an invoice's due date, which trigger (if any) fires today.
 */
export function reminderTriggerFor(
  invoice: Pick<Invoice, "dueDate">,
  now: Date,
): ReminderTrigger | null {
  const delta = daysUntil(invoice.dueDate, now);
  if (delta === 7) return "due_in_7_days";
  if (delta === 0) return "due_today";
  if (delta === -3) return "overdue_3_days";
  if (delta === -7) return "overdue_7_days";
  return null;
}

/**
 * Email delivery (Resend/SendGrid, Handbook 10.7) isn't wired up yet — this
 * is honestly a stub, same status as the Paystack/Flutterwave/Stripe gateway
 * abstraction until real provider credentials exist. It still does the real
 * work of deciding WHO gets reminded and WHEN, and logs + audits every
 * reminder "sent" so the pipeline is fully testable ahead of the email
 * integration landing.
 */
async function deliverReminderEmail(invoice: Invoice, trigger: ReminderTrigger): Promise<void> {
  logger.info(
    { invoiceId: invoice.id, invoiceNumber: invoice.number, trigger },
    "[stub] would send reminder email — Resend/SendGrid integration not yet wired up",
  );
}

export async function processRemindersForOrg(orgId: string, now: Date): Promise<number> {
  const candidates = await invoiceRepo.listAllByOrg(orgId);
  let sent = 0;
  for (const invoice of candidates) {
    if (["paid", "written_off", "void", "draft"].includes(invoice.status)) continue;
    const trigger = reminderTriggerFor(invoice, now);
    if (!trigger) continue;

    await deliverReminderEmail(invoice, trigger);
    await auditLogRepo.write({
      orgId,
      action: "invoice.reminder_sent",
      entityType: "invoice",
      entityId: invoice.id,
      newValue: { trigger },
    });
    sent++;
  }
  return sent;
}
