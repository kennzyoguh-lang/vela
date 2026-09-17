import { randomBytes, createHmac } from "node:crypto";
import * as configRepo from "../repositories/payroll-export.repository";
import * as payrollRunRepo from "../repositories/payroll-run.repository";
import * as payslipRepo from "../repositories/payslip.repository";
import * as employeeRepo from "../repositories/employee.repository";
import { encryptSecret, decryptSecret } from "../lib/encryption";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { NotFoundError, ValidationError } from "../lib/errors";
import type { PayrollRun, Payslip, Employee } from "@prisma/client";

function requireEncryptionKey(): string {
  if (!env.PAYROLL_EXPORT_ENCRYPTION_KEY_BASE64) {
    throw new Error(
      "Payroll export encryption is not configured — set PAYROLL_EXPORT_ENCRYPTION_KEY_BASE64",
    );
  }
  return env.PAYROLL_EXPORT_ENCRYPTION_KEY_BASE64;
}

// "whsec_" prefix mirrors Stripe/GitHub's own outbound-webhook secret
// convention — recognizable at a glance as a signing secret, not an API key.
function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export interface PayrollExportConfigSummary {
  webhookUrl: string;
  isActive: boolean;
  lastDeliveryAt: Date | null;
  lastDeliveryError: string | null;
}

function assertValidWebhookUrl(webhookUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new ValidationError("Webhook URL is not a valid URL", "webhookUrl");
  }
  if (parsed.protocol !== "https:") {
    throw new ValidationError("Webhook URL must use https", "webhookUrl");
  }
}

/**
 * Configures (or replaces) the org's payroll-export webhook and mints a
 * fresh signing secret. The secret is returned here and ONLY here — like an
 * API key, it is never retrievable again after this call, and getConfig()
 * below never includes it.
 */
export async function configure(
  orgId: string,
  webhookUrl: string,
): Promise<{ webhookUrl: string; secret: string }> {
  assertValidWebhookUrl(webhookUrl);
  const key = requireEncryptionKey();
  const secret = generateWebhookSecret();
  const saved = await configRepo.upsert(orgId, webhookUrl, encryptSecret(secret, key, orgId));
  return { webhookUrl: saved.webhookUrl, secret };
}

export async function regenerateSecret(orgId: string): Promise<{ secret: string }> {
  const existing = await configRepo.findByOrg(orgId);
  if (!existing) {
    throw new NotFoundError("No payroll export webhook is configured for this organisation yet");
  }
  const key = requireEncryptionKey();
  const secret = generateWebhookSecret();
  await configRepo.updateSecret(orgId, encryptSecret(secret, key, orgId));
  return { secret };
}

export async function getConfig(orgId: string): Promise<PayrollExportConfigSummary | null> {
  const config = await configRepo.findByOrg(orgId);
  if (!config) return null;
  return {
    webhookUrl: config.webhookUrl,
    isActive: config.isActive,
    lastDeliveryAt: config.lastDeliveryAt,
    lastDeliveryError: config.lastDeliveryError,
  };
}

export async function disable(orgId: string): Promise<void> {
  await configRepo.deactivate(orgId);
}

interface ExportRow {
  employeeName: string;
  jobTitle: string;
  grossPay: number;
  paye: number;
  employeePension: number;
  employerPension: number;
  nhf: number;
  netPay: number;
}

async function buildExportRows(
  orgId: string,
  runId: string,
): Promise<{ run: PayrollRun; rows: ExportRow[] }> {
  const run = await payrollRunRepo.findById(orgId, runId);
  if (!run) throw new NotFoundError("Payroll run not found");

  const payslips = await payslipRepo.listByRun(orgId, runId);
  const employees = await employeeRepo.listByIds(
    orgId,
    payslips.map((p) => p.employeeId),
  );
  const employeeById = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  const rows = payslips.map((payslip: Payslip) => {
    const employee = employeeById.get(payslip.employeeId);
    return {
      employeeName: employee?.name ?? "Unknown employee",
      jobTitle: employee?.jobTitle ?? "",
      grossPay: Number(payslip.grossPay),
      paye: Number(payslip.paye),
      employeePension: Number(payslip.employeePension),
      employerPension: Number(payslip.employerPension),
      nhf: Number(payslip.nhf),
      netPay: Number(payslip.netPay),
    };
  });

  return { run, rows };
}

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * A CSV of one payroll run — works whether or not the org has configured a
 * webhook, since most third-party payroll/accounting apps can import CSV
 * directly. This is the "always available" half of the connector; the
 * webhook below is the "live, automatic" half for a receiving system that
 * can accept one.
 */
export async function exportRunAsCsv(orgId: string, runId: string): Promise<string> {
  const { rows } = await buildExportRows(orgId, runId);
  const header = [
    "Employee",
    "Job title",
    "Gross pay",
    "PAYE",
    "Employee pension",
    "Employer pension",
    "NHF",
    "Net pay",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.employeeName),
        csvEscape(row.jobTitle),
        csvEscape(row.grossPay),
        csvEscape(row.paye),
        csvEscape(row.employeePension),
        csvEscape(row.employerPension),
        csvEscape(row.nhf),
        csvEscape(row.netPay),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * Delivers a signed webhook for one finalized payroll run — called from
 * payroll.service.ts#markRunPaid. Never throws: a missing/disabled config
 * is a silent no-op, and any delivery failure is caught, logged, and
 * recorded on the config (lastDeliveryError, surfaced in the settings UI)
 * rather than allowed to fail the payroll-run action that triggered it,
 * same "never block the primary action" contract as cash-check.service.ts's
 * flagMismatchToOwner.
 */
export async function deliverPayrollRunExport(orgId: string, runId: string): Promise<void> {
  const config = await configRepo.findByOrg(orgId);
  if (!config || !config.isActive) return;

  try {
    const key = requireEncryptionKey();
    const secret = decryptSecret(config.webhookSecretEncrypted, key, orgId);
    const { run, rows } = await buildExportRows(orgId, runId);

    const payload = JSON.stringify({
      event: "payroll_run.paid",
      periodLabel: run.periodLabel,
      totalGrossPay: Number(run.totalGrossPay),
      totalDeductions: Number(run.totalDeductions),
      totalNetPay: Number(run.totalNetPay),
      payslips: rows,
    });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Vela-Signature": signature },
      body: payload,
    });
    if (!res.ok) {
      throw new Error(`Webhook endpoint responded with ${res.status}`);
    }

    await configRepo.recordDelivery(orgId, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ orgId, runId, err }, "Payroll export webhook delivery failed");
    await configRepo.recordDelivery(orgId, message);
  }
}
