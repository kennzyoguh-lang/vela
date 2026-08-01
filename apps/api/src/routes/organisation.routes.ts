import { Router } from "express";
import * as organisationController from "../controllers/organisation.controller";
import * as businessProfileController from "../controllers/business-profile.controller";
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

// No generic auditLog() middleware here — organisation.service.ts#setDiscountApprovalPin
// already writes its own audit entry (same reasoning as cash-check.routes.ts).
organisationRouter.patch(
  "/discount-approval-pin",
  requireRole("owner", "admin"),
  asyncHandler(organisationController.setDiscountApprovalPin),
);

// No generic auditLog() middleware here — organisation.service.ts#setNotificationPhone
// already writes its own audit entry (same reasoning as discount-approval-pin above).
organisationRouter.patch(
  "/notification-phone",
  requireRole("owner", "admin"),
  asyncHandler(organisationController.setNotificationPhone),
);

// Business profiling — GET is open to every authenticated org member
// (owner/admin/staff/accountant/view_only), not just owner/admin: module
// visibility affects what EVERYONE sees in their own UI (e.g. staff need to
// know whether Quick Sale shows on their own POS screen). Only the two
// mutations below are owner/admin-gated, same as every other org setting.
organisationRouter.get("/business-profile", asyncHandler(businessProfileController.getProfile));
// No generic auditLog() middleware here — business-profile.service.ts
// already writes its own audit entry (same reasoning as discount-approval-pin).
organisationRouter.patch(
  "/business-profile/factors",
  requireRole("owner", "admin"),
  asyncHandler(businessProfileController.setFactors),
);
organisationRouter.patch(
  "/business-profile/module-override",
  requireRole("owner", "admin"),
  asyncHandler(businessProfileController.setModuleOverride),
);
// Graduation prompts (piece 4) — owner/admin only, unlike the GET above:
// these surface a suggested FACTOR change for the owner to confirm, not
// something every role's own UI needs to know about.
organisationRouter.get(
  "/business-profile/graduation-prompts",
  requireRole("owner", "admin"),
  asyncHandler(businessProfileController.getGraduationPrompts),
);
organisationRouter.patch(
  "/business-profile/graduation-prompt",
  requireRole("owner", "admin"),
  asyncHandler(businessProfileController.confirmGraduationPrompt),
);

organisationRouter.post(
  "/staff",
  requireRole("owner", "admin"),
  auditLog("staff.create", "user"),
  asyncHandler(organisationController.createStaff),
);
organisationRouter.post(
  "/staff/:userId/reset-device",
  requireRole("owner", "admin"),
  auditLog("staff.device_reset", "user"),
  asyncHandler(organisationController.resetStaffDevice),
);

organisationRouter.post(
  "/accountant-links",
  requireRole("owner", "admin"),
  auditLog("accountant_link.create", "accountant_client_link"),
  asyncHandler(organisationController.inviteAccountant),
);
organisationRouter.get(
  "/accountant-links",
  requireRole("owner", "admin"),
  asyncHandler(organisationController.listAccountantLinks),
);
organisationRouter.delete(
  "/accountant-links/:linkId",
  requireRole("owner", "admin"),
  auditLog("accountant_link.revoke", "accountant_client_link"),
  asyncHandler(organisationController.revokeAccountantLink),
);
