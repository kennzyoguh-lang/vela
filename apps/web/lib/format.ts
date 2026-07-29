import type { InvoiceStatus } from "@vela/types";

export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(value);
}

// Design System 4.25's "due phrase" — never a bare date, always relative to
// today, and reframed once an invoice leaves the payable states.
export function formatDuePhrase(dueDate: string, status: InvoiceStatus): string {
  if (status === "paid") return "Paid";
  if (status === "void") return "Void";
  if (status === "written_off") return "Written off";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  const overdueDays = Math.abs(days);
  return `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`;
}
