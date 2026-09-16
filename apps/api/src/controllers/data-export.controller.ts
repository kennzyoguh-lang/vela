import type { Request, Response } from "express";
import * as dataExportService from "../services/data-export.service";
import { getAuthContext } from "../lib/auth-context";

export async function download(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  const bundle = await dataExportService.exportOrgData(orgId, userId);

  const filename = `vela-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(bundle, null, 2));
}
