import { Router } from "express";
import * as complianceController from "../controllers/compliance.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const complianceRouter = Router();
complianceRouter.use(requireAuth, apiRateLimit());

complianceRouter.get("/obligations", asyncHandler(complianceController.listObligations));
complianceRouter.patch(
  "/obligations/:obligationType",
  requireRole("owner", "admin"),
  auditLog("compliance.obligation_toggled", "org_compliance_obligation"),
  asyncHandler(complianceController.toggleObligation),
);
complianceRouter.get("/filings", asyncHandler(complianceController.listFilings));
complianceRouter.get("/filings/:filingId", asyncHandler(complianceController.getFiling));
complianceRouter.post(
  "/filings/:filingId/mark-filed",
  requireRole("owner", "admin"),
  auditLog("compliance.filing_marked_filed", "compliance_filing"),
  asyncHandler(complianceController.markFiled),
);
