import { renderEmailLayout, type EmailContent } from "./layout";
import type { ReminderTrigger } from "../../services/reminder.service";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

// F-04's fixed reminder sequence, in plain language — the trigger itself
// (reminder.service.ts#reminderTriggerFor) decides WHEN this fires; this
// only decides the wording once it does.
function reminderPhrase(trigger: ReminderTrigger): { subjectPrefix: string; lead: string } {
  switch (trigger) {
    case "due_in_7_days":
      return { subjectPrefix: "Due in 7 days", lead: "is due in 7 days" };
    case "due_today":
      return { subjectPrefix: "Due today", lead: "is due today" };
    case "overdue_3_days":
      return { subjectPrefix: "3 days overdue", lead: "is now 3 days overdue" };
    case "overdue_7_days":
      return { subjectPrefix: "7 days overdue", lead: "is now 7 days overdue" };
  }
}

export function invoiceReminderEmail(params: {
  clientName: string;
  orgName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: Date;
  payUrl: string;
  trigger: ReminderTrigger;
}): EmailContent {
  const amount = formatMoney(params.total, params.currency);
  const due = formatDate(params.dueDate);
  const { subjectPrefix, lead } = reminderPhrase(params.trigger);
  const subject = `${subjectPrefix}: Invoice ${params.invoiceNumber} from ${params.orgName} — ${amount}`;
  const bodyHtml = `
    <p>Hi ${params.clientName},</p>
    <p>A reminder that invoice <strong>${params.invoiceNumber}</strong> from ${params.orgName}
    for <strong>${amount}</strong> ${lead} (due ${due}).</p>
    <p style="margin-top:24px;"><a href="${params.payUrl}" style="background-color:#C9A84C;color:#0D1B2A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">View &amp; pay invoice</a></p>`;
  const text = `Hi ${params.clientName},\n\nA reminder that invoice ${params.invoiceNumber} from ${params.orgName} for ${amount} ${lead} (due ${due}).\n\nView & pay: ${params.payUrl}`;
  return { subject, html: renderEmailLayout({ preheader: subject, bodyHtml }), text };
}
