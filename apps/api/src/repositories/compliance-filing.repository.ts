import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { ComplianceFiling, ComplianceObligationType } from "@prisma/client";

// Idempotent by construction — the @@unique([orgId, obligationType,
// periodLabel]) constraint means a re-run of the daily generation job for a
// period that already has a row just upserts a no-op, never a duplicate
// (same shape as recurring-invoice.repository.ts's generation pattern).
export async function upsertPeriod(
  orgId: string,
  obligationType: ComplianceObligationType,
  periodLabel: string,
  dueDate: Date,
): Promise<ComplianceFiling> {
  return withOrgScope(orgId, (tx) =>
    tx.complianceFiling.upsert({
      where: { orgId_obligationType_periodLabel: { orgId, obligationType, periodLabel } },
      create: { id: randomUUID(), orgId, obligationType, periodLabel, dueDate },
      update: {},
    }),
  );
}

export async function listByOrg(orgId: string): Promise<ComplianceFiling[]> {
  return withOrgScope(orgId, (tx) =>
    tx.complianceFiling.findMany({ where: { orgId }, orderBy: { dueDate: "asc" } }),
  );
}

export async function findById(orgId: string, filingId: string): Promise<ComplianceFiling | null> {
  return withOrgScope(orgId, (tx) =>
    tx.complianceFiling.findFirst({ where: { id: filingId, orgId } }),
  );
}

export async function markFiled(
  orgId: string,
  filingId: string,
  input: { filedAt: Date; receiptReference?: string; notes?: string },
): Promise<ComplianceFiling> {
  return withOrgScope(orgId, (tx) =>
    tx.complianceFiling.update({
      where: { id: filingId, orgId },
      data: {
        filedAt: input.filedAt,
        receiptReference: input.receiptReference,
        notes: input.notes,
      },
    }),
  );
}
