import * as filingRepo from "../repositories/compliance-filing.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
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

// Email/SMS delivery isn't wired up yet — same honest stub status as
// reminder.service.ts's deliverReminderEmail until a provider is chosen.
async function deliverComplianceReminder(
  filing: ComplianceFiling,
  trigger: ComplianceReminderTrigger,
): Promise<void> {
  logger.info(
    { filingId: filing.id, obligationType: filing.obligationType, trigger },
    "[stub] would send compliance reminder — email/SMS integration not yet wired up",
  );
}

export async function processComplianceRemindersForOrg(orgId: string, now: Date): Promise<number> {
  const filings = await filingRepo.listByOrg(orgId);
  let sent = 0;
  for (const filing of filings) {
    if (filing.filedAt) continue;
    const trigger = complianceReminderTriggerFor(filing, now);
    if (!trigger) continue;

    await deliverComplianceReminder(filing, trigger);
    await auditLogRepo.write({
      orgId,
      action: "compliance.reminder_sent",
      entityType: "compliance_filing",
      entityId: filing.id,
      newValue: {
        trigger,
        obligationType: filing.obligationType,
        label: OBLIGATION_RULES[filing.obligationType].label,
      },
    });
    sent++;
  }
  return sent;
}
