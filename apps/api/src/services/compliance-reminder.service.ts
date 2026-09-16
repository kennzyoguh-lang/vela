import * as filingRepo from "../repositories/compliance-filing.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as smsGateway from "./sms/termii.gateway";
import * as emailGateway from "./email/email.gateway";
import { getBusinessProfile } from "./business-profile.service";
import { computeNotificationChannelDefault } from "@vela/types";
import { OBLIGATION_RULES } from "./compliance-obligation-rules";
import { logger } from "../lib/logger";
import type { ComplianceFiling } from "@prisma/client";

export type ComplianceReminderTrigger =
  "due_in_7_days" | "due_tomorrow" | "due_today" | "overdue_3_days" | "overdue_7_days";

function daysUntil(dueDate: Date, now: Date): number {
  return Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Pure function — given "now" and a filing's due date, which trigger (if
 * any) fires today. Same trigger-day shape as reminder.service.ts's
 * reminderTriggerFor, with an added due_tomorrow step since missing a
 * government filing carries real financial-penalty risk, not just a
 * relationship cost with a client.
 */
export function complianceReminderTriggerFor(
  filing: Pick<ComplianceFiling, "dueDate">,
  now: Date,
): ComplianceReminderTrigger | null {
  const delta = daysUntil(filing.dueDate, now);
  if (delta === 7) return "due_in_7_days";
  if (delta === 1) return "due_tomorrow";
  if (delta === 0) return "due_today";
  if (delta === -3) return "overdue_3_days";
  if (delta === -7) return "overdue_7_days";
  return null;
}

function triggerPhrase(trigger: ComplianceReminderTrigger): string {
  switch (trigger) {
    case "due_in_7_days":
      return "is due in 7 days";
    case "due_tomorrow":
      return "is due tomorrow";
    case "due_today":
      return "is due today";
    case "overdue_3_days":
      return "is now 3 days overdue";
    case "overdue_7_days":
      return "is now 7 days overdue";
  }
}

// Plain-language, same "no jargon, understandable without opening the app"
// bar as owner-summary.service.ts#composeSummaryMessage — this is a
// notification to the org owner/admin, not a client-facing document, so it
// gets that service's simple one-line style rather than invoice-reminder's
// branded HTML template.
export function composeComplianceReminderMessage(
  filing: Pick<ComplianceFiling, "obligationType">,
  trigger: ComplianceReminderTrigger,
): string {
  const label = OBLIGATION_RULES[filing.obligationType].label;
  return `${label} ${triggerPhrase(trigger)}. File now to avoid penalties.`;
}

/**
 * Notifies every owner/admin at the org, via whichever channel business
 * profiling's notification-channel default picks — the exact same pattern
 * as owner-summary.service.ts#sendDailySummary (email for a formal/CAC-
 * registered org, WhatsApp/SMS otherwise). One recipient's bad address must
 * never stop another recipient at the same org from being notified, hence
 * the per-recipient try/catch.
 */
async function deliverComplianceReminder(
  filing: ComplianceFiling,
  trigger: ComplianceReminderTrigger,
  recipients: Array<{ email: string | null; phone: string | null }>,
  channel: "email" | "whatsapp_sms",
): Promise<void> {
  const message = composeComplianceReminderMessage(filing, trigger);
  const label = OBLIGATION_RULES[filing.obligationType].label;

  if (channel === "email") {
    const emails = recipients.map((r) => r.email).filter((e): e is string => e !== null);
    if (emails.length === 0) {
      logger.info(
        { filingId: filing.id, trigger },
        "Compliance reminder — no owner/admin email configured, nothing sent",
      );
      return;
    }
    await Promise.all(
      emails.map(async (email) => {
        try {
          await emailGateway.sendEmail(email, `VELA compliance reminder: ${label}`, message);
        } catch (err) {
          logger.error(
            { err, filingId: filing.id, email },
            "Failed to send compliance reminder email",
          );
        }
      }),
    );
  } else {
    const phones = recipients.map((r) => r.phone).filter((p): p is string => p !== null);
    if (phones.length === 0) {
      logger.info(
        { filingId: filing.id, trigger },
        "Compliance reminder — no owner/admin notification phone configured, nothing sent",
      );
      return;
    }
    await Promise.all(
      phones.map(async (phone) => {
        try {
          await smsGateway.sendSms(phone, message);
        } catch (err) {
          logger.error(
            { err, filingId: filing.id, phone },
            "Failed to send compliance reminder SMS",
          );
        }
      }),
    );
  }
}

export async function processComplianceRemindersForOrg(orgId: string, now: Date): Promise<number> {
  const filings = await filingRepo.listByOrg(orgId);
  const dueFilings = filings.filter(
    (filing) => !filing.filedAt && complianceReminderTriggerFor(filing, now) !== null,
  );
  if (dueFilings.length === 0) return 0;

  const [factors, recipients] = await Promise.all([
    getBusinessProfile(orgId),
    userRepo.findNotifiableRecipients(orgId),
  ]);
  const channel = computeNotificationChannelDefault(factors);

  let sent = 0;
  for (const filing of dueFilings) {
    const trigger = complianceReminderTriggerFor(filing, now)!;
    await deliverComplianceReminder(filing, trigger, recipients, channel);
    await auditLogRepo.write({
      orgId,
      action: "compliance.reminder_sent",
      entityType: "compliance_filing",
      entityId: filing.id,
      newValue: {
        trigger,
        obligationType: filing.obligationType,
        label: OBLIGATION_RULES[filing.obligationType].label,
        channel,
      },
    });
    sent++;
  }
  return sent;
}
