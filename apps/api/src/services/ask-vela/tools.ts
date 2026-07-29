import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import * as invoiceRepo from "../../repositories/invoice.repository";
import * as bankAccountRepo from "../../repositories/bank-account.repository";
import * as complianceService from "../compliance.service";
import * as pnlService from "../pnl.service";
import * as payrollService from "../payroll.service";

export interface Citation {
  module: string;
  refId: string;
  label: string;
}

export interface ToolResult {
  data: unknown;
  citations: Citation[];
}

export interface AskVelaTool {
  name: string;
  description: string;
  input_schema: Tool.InputSchema;
  // orgId always comes from the authenticated request's own JWT claim, never
  // from tool input — there is no code path where the model could supply a
  // different org id to a tool call.
  execute(orgId: string, input: unknown): Promise<ToolResult>;
}

const OUTSTANDING_INVOICE_STATUSES = ["sent", "viewed", "partially_paid", "overdue"] as const;

const getOutstandingInvoicesSchema = z.object({
  status: z
    .enum(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "written_off", "void"])
    .optional(),
});

const getPnlSummarySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
});

const getPayrollStatusSchema = z.object({
  periodLabel: z.string().optional(),
});

export const askVelaTools: AskVelaTool[] = [
  {
    name: "get_outstanding_invoices",
    description:
      "Get the org's outstanding (unpaid) invoices, or all invoices in a specific status. " +
      "Call this when asked about money owed by clients, overdue invoices, or invoice totals. " +
      "Omit `status` to get every unpaid invoice (sent, viewed, partially_paid, overdue).",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "draft",
            "sent",
            "viewed",
            "partially_paid",
            "paid",
            "overdue",
            "written_off",
            "void",
          ],
          description: "Optional — narrow to one invoice status instead of the default unpaid set.",
        },
      },
    },
    async execute(orgId, rawInput) {
      const input = getOutstandingInvoicesSchema.parse(rawInput ?? {});
      const invoices = input.status
        ? await invoiceRepo.listByOrg(orgId, { status: input.status })
        : (await invoiceRepo.listByOrg(orgId)).filter((i) =>
            OUTSTANDING_INVOICE_STATUSES.includes(
              i.status as (typeof OUTSTANDING_INVOICE_STATUSES)[number],
            ),
          );
      const total = invoices.reduce((sum, i) => sum + Number(i.total), 0);
      return {
        data: {
          count: invoices.length,
          total,
          invoices: invoices.map((i) => ({
            id: i.id,
            number: i.number,
            status: i.status,
            total: Number(i.total),
            currency: i.currency,
            dueDate: i.dueDate,
          })),
        },
        citations: invoices.map((i) => ({
          module: "invoice",
          refId: i.id,
          label: `${i.number} — ${i.currency} ${Number(i.total).toLocaleString()} — ${i.status}`,
        })),
      };
    },
  },
  {
    name: "get_compliance_status",
    description:
      "Get the org's Nigerian tax/regulatory filing obligations and their current status " +
      "(upcoming, due_soon, overdue, filed). Call this when asked about compliance deadlines, " +
      "VAT/PAYE/pension/WHT/CIT filings, or CAC returns.",
    input_schema: { type: "object", properties: {} },
    async execute(orgId) {
      const [filings, obligations] = await Promise.all([
        complianceService.listFilings(orgId),
        complianceService.listObligations(orgId),
      ]);
      const labelByType = new Map(obligations.map((o) => [o.type, o.label]));
      return {
        data: {
          filings: filings.map((f) => ({
            id: f.id,
            obligationType: f.obligationType,
            label: labelByType.get(f.obligationType) ?? f.obligationType,
            periodLabel: f.periodLabel,
            dueDate: f.dueDate,
            status: f.status,
          })),
        },
        citations: filings
          .filter((f) => f.status !== "filed")
          .map((f) => ({
            module: "compliance",
            refId: f.id,
            label: `${labelByType.get(f.obligationType) ?? f.obligationType} — ${f.periodLabel} — ${f.status}`,
          })),
      };
    },
  },
  {
    name: "get_pnl_summary",
    description:
      "Get the org's profit & loss for a date range: income, expenses by category, total " +
      "expenses, and net profit. Call this when asked about profit, revenue, expenses, or " +
      "financial performance over a period. Dates must be ISO format (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date, ISO format YYYY-MM-DD" },
        to: { type: "string", description: "End date, ISO format YYYY-MM-DD" },
      },
      required: ["from", "to"],
    },
    async execute(orgId, rawInput) {
      const input = getPnlSummarySchema.parse(rawInput);
      const result = await pnlService.getPnlStatement(
        orgId,
        new Date(input.from),
        new Date(input.to),
      );
      return {
        data: result,
        citations: [
          {
            module: "pnl",
            refId: `${input.from}_${input.to}`,
            label: `P&L ${input.from} to ${input.to}`,
          },
        ],
      };
    },
  },
  {
    name: "get_cash_position",
    description:
      "Get the org's current cash position across all active bank accounts. Call this when " +
      "asked about cash balance, how much money is in the bank, or liquidity.",
    input_schema: { type: "object", properties: {} },
    async execute(orgId) {
      const accounts = await bankAccountRepo.listActiveByOrg(orgId);
      const total = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
      return {
        data: {
          total,
          accounts: accounts.map((a) => ({
            id: a.id,
            institutionName: a.institutionName,
            accountType: a.accountType,
            currentBalance: Number(a.currentBalance),
            currency: a.currency,
          })),
        },
        citations: accounts.map((a) => ({
          module: "bank_account",
          refId: a.id,
          label: `${a.institutionName} — ${a.currency} ${Number(a.currentBalance).toLocaleString()}`,
        })),
      };
    },
  },
  {
    name: "get_payroll_status",
    description:
      "Get the org's payroll run summaries (period, status, gross/net pay totals). Never " +
      "returns individual employee names or payslip detail. Call this when asked about payroll " +
      "status, whether payroll has been run, or payroll totals. Omit `periodLabel` to get all runs.",
    input_schema: {
      type: "object",
      properties: {
        periodLabel: {
          type: "string",
          description: "Optional — narrow to one period, format YYYY-MM (e.g. 2026-07).",
        },
      },
    },
    async execute(orgId, rawInput) {
      const input = getPayrollStatusSchema.parse(rawInput ?? {});
      const allRuns = await payrollService.listRuns(orgId);
      const runs = input.periodLabel
        ? allRuns.filter((r) => r.periodLabel === input.periodLabel)
        : allRuns;
      return {
        data: {
          runs: runs.map((r) => ({
            id: r.id,
            periodLabel: r.periodLabel,
            status: r.status,
            totalGrossPay: Number(r.totalGrossPay),
            totalDeductions: Number(r.totalDeductions),
            totalNetPay: Number(r.totalNetPay),
          })),
        },
        citations: runs.map((r) => ({
          module: "payroll_run",
          refId: r.id,
          label: `Payroll ${r.periodLabel} — ${r.status}`,
        })),
      };
    },
  },
];

export function getToolByName(name: string): AskVelaTool | undefined {
  return askVelaTools.find((t) => t.name === name);
}
