import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as emailGateway from "./email/email.gateway";
import { invoiceReminderEmail } from "../email/templates/invoice-reminder";
import { env } from "../lib/env";
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
 * Delivers via the same Resend gateway owner-summary.service.ts uses — that
 * gateway already degrades to an honest "[stub] would send" log when
 * RESEND_API_KEY is unset (Handbook 1.4: a missing third-party key must
 * never block anything), so this function itself never needs a "not wired
 * up yet" branch. A client with no email on file is a real data-quality
 * gap, not a delivery failure — logged distinctly so it's easy to tell
 * apart from an actual send error in the logs.
 */
async function deliverReminderEmail(
  invoice: Invoice,
  trigger: ReminderTrigger,
  clientName: string,
  clientEmail: string | null,
  orgName: string,
): Promise<boolean> {
  if (!clientEmail) {
    logger.info(
      { invoiceId: invoice.id, invoiceNumber: invoice.number, trigger },
      "Invoice reminder skipped — client has no email on file",
    );
    return false;
  }

  const payUrl = `${env.WEB_APP_URL}/pay/${invoice.paymentPortalToken}`;
  const { subject, html, text } = invoiceReminderEmail({
    clientName,
    orgName,
    invoiceNumber: invoice.number,
    total: Number(invoice.total),
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    payUrl,
    trigger,
  });
  await emailGateway.sendEmail(clientEmail, subject, text, html);
  return true;
}

export async function processRemindersForOrg(orgId: string, now: Date): Promise<number> {
  const [candidates, organisation] = await Promise.all([
    invoiceRepo.listAllByOrg(orgId),
    organisationRepo.findOrganisationById(orgId),
  ]);
  const orgName = organisation?.name ?? "your supplier";
  let sent = 0;
  for (const invoice of candidates) {
    if (["paid", "written_off", "void", "draft"].includes(invoice.status)) continue;
    const trigger = reminderTriggerFor(invoice, now);
    if (!trigger) continue;

    const client = invoice.clientId ? await clientRepo.findById(orgId, invoice.clientId) : null;
    let delivered: boolean;
    try {
      delivered = await deliverReminderEmail(
        invoice,
        trigger,
        client?.name ?? "there",
        client?.email ?? null,
        orgName,
      );
    } catch (err) {
      // One client's bad address or a transient provider error must never
      // stop the rest of this org's reminders (or another org's, per
      // reminder.job.ts's per-org isolation) — logged, not swallowed.
      logger.error(
        { err, orgId, invoiceId: invoice.id, trigger },
        "Failed to send invoice reminder email",
      );
      continue;
    }
    if (!delivered) continue; // no email on file — nothing was actually sent, don't audit as if it were

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
