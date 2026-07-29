import { Router } from "express";
import * as employeeController from "../controllers/employee.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const employeeRouter = Router();
employeeRouter.use(requireAuth, apiRateLimit(), requireRole("owner", "admin"));

employeeRouter.post(
  "/",
  auditLog("employee.create", "employee"),
  asyncHandler(employeeController.create),
);
employeeRouter.get("/", asyncHandler(employeeController.list));
employeeRouter.get("/:employeeId", asyncHandler(employeeController.getOne));
employeeRouter.patch(
  "/:employeeId",
  auditLog("employee.update", "employee"),
  asyncHandler(employeeController.update),
);
