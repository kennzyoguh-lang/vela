import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/data-export.repository", () => ({
  gatherOrgExport: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));

import * as dataExportRepo from "../repositories/data-export.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { exportOrgData } from "./data-export.service";

describe("data-export.service#exportOrgData", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the gathered bundle with export metadata attached", async () => {
    vi.mocked(dataExportRepo.gatherOrgExport).mockResolvedValue({
      organisation: { id: orgId, name: "Acme Traders" },
      clients: [],
    } as never);

    const result = await exportOrgData(orgId, actorId);

    expect(result.orgId).toBe(orgId);
    expect(result.exportedAt).toEqual(expect.any(String));
    expect(result.organisation).toEqual({ id: orgId, name: "Acme Traders" });
  });

  it("audit-logs the export with the actor and org, after a successful gather", async () => {
    vi.mocked(dataExportRepo.gatherOrgExport).mockResolvedValue({} as never);

    await exportOrgData(orgId, actorId);

    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "data_export.downloaded",
        entityType: "organisation",
        entityId: orgId,
      }),
    );
  });

  it("never audit-logs when the gather itself fails", async () => {
    vi.mocked(dataExportRepo.gatherOrgExport).mockRejectedValue(new Error("db unreachable"));

    await expect(exportOrgData(orgId, actorId)).rejects.toThrow("db unreachable");
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });
});
