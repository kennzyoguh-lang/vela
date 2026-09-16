import { Router } from "express";
import * as dataExportController from "../controllers/data-export.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const dataExportRouter = Router();
dataExportRouter.use(requireAuth, apiRateLimit());

// F-63 — Owner/Admin only, per the BRD's own permission spec for a full-org
// data operation. NOT using the generic auditLog(...) middleware here: it
// wraps res.json, but this endpoint calls res.send() directly (needed for
// the file-download Content-Disposition header) — the wrapped res.json
// would simply never fire, silently skipping the audit write it looks like
// it provides. data-export.service.ts writes its own explicit
// "data_export.downloaded" entry instead, after a successful gather.
dataExportRouter.get(
  "/",
  requireRole("owner", "admin"),
  asyncHandler(dataExportController.download),
);
