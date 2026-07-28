import { Router } from "express";
import * as organisationController from "../controllers/organisation.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const organisationRouter = Router();
// Middleware chain order is load-bearing (Handbook 5.5): auth (learns org_id)
// before the per-org rate limiter, RBAC per-route after both.
organisationRouter.use(requireAuth, apiRateLimit());

organisationRouter.post(
  "/invites",
  requireRole("owner", "admin"),
  auditLog("invite.create", "organisation_invite"),
  asyncHandler(organisationController.inviteUser),
);
organisationRouter.get(
  "/invites",
  requireRole("owner", "admin"),
  asyncHandler(organisationController.listPendingInvites),
);
organisationRouter.delete(
  "/invites/:inviteId",
  requireRole("owner", "admin"),
  auditLog("invite.revoke", "organisation_invite"),
  asyncHandler(organisationController.revokeInvite),
);
organisationRouter.patch(
  "/users/:userId/role",
  requireRole("owner"),
  auditLog("user.role_change", "user"),
  asyncHandler(organisationController.changeUserRole),
);
organisationRouter.post(
  "/users/:userId/deactivate",
  requireRole("owner", "admin"),
  auditLog("user.deactivate", "user"),
  asyncHandler(organisationController.deactivateUser),
);
