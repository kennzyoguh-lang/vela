import * as dataExportRepo from "../repositories/data-export.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";

/**
 * F-63 — NDPR right-to-portability made concrete: a full JSON export of the
 * org's own business data. Synchronous by design (Horizon 1, Handbook 1.5)
 * — this codebase has no object-storage layer yet (invoice/payslip PDFs are
 * generated on demand and streamed, never persisted), so a background job
 * would need to build that infrastructure just to hold one file; at current
 * data volumes a direct query-and-stream is simpler and correct. Revisit
 * only with evidence a real org's export is slow enough to need it.
 */
export async function exportOrgData(orgId: string, actorId: string) {
  const bundle = await dataExportRepo.gatherOrgExport(orgId);

  // "Export logged to audit trail" (BRD F-63) — logged after a successful
  // gather, not before, so a failed export never falsely claims one
  // happened.
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "data_export.downloaded",
    entityType: "organisation",
    entityId: orgId,
  });

  return {
    exportedAt: new Date().toISOString(),
    orgId,
    ...bundle,
  };
}
