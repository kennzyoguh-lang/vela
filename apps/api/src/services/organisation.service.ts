import * as inviteRepo from "../repositories/invite.repository";
import * as userRepo from "../repositories/user.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { BusinessRuleViolationError, ConflictError } from "../lib/errors";
import type { Role } from "@prisma/client";

const INVITE_TTL_DAYS = 7;

export async function inviteUser(orgId: string, invitedBy: string, email: string, role: Role) {
  const existing = await userRepo.findByEmail(email);
  if (existing && existing.orgId === orgId) {
    throw new ConflictError("This email is already a member of your organisation");
  }
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invite = await inviteRepo.createInvite(orgId, { email, role, invitedBy, expiresAt });
  await auditLogRepo.write({
    orgId,
    userId: invitedBy,
    action: "invite.created",
    entityType: "organisation_invite",
    entityId: invite.id,
    newValue: { email, role },
  });
  return invite;
}

export async function listPendingInvites(orgId: string) {
  return inviteRepo.listPendingForOrg(orgId);
}

export async function revokeInvite(orgId: string, actorId: string, inviteId: string) {
  await inviteRepo.markStatus(orgId, inviteId, "revoked");
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "invite.revoked",
    entityType: "organisation_invite",
    entityId: inviteId,
  });
}

/**
 * The last active Owner can never be deactivated or demoted (Design System
 * 6.11.2) — blocked with an explicit reason, not a silently disabled button.
 */
export async function changeRole(orgId: string, actorId: string, targetUserId: string, role: Role) {
  const target = await userRepo.findById(orgId, targetUserId);
  if (!target) throw new BusinessRuleViolationError("User not found in this organisation");
  if (target.role === "owner" && role !== "owner") {
    const ownerCount = await userRepo.countOwners(orgId);
    if (ownerCount <= 1) {
      throw new BusinessRuleViolationError(
        "The last Owner cannot be demoted — assign another Owner first",
      );
    }
  }
  await userRepo.updateRole(orgId, targetUserId, role);
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "user.role_changed",
    entityType: "user",
    entityId: targetUserId,
    oldValue: { role: target.role },
    newValue: { role },
  });
}

export async function deactivateUser(orgId: string, actorId: string, targetUserId: string) {
  const target = await userRepo.findById(orgId, targetUserId);
  if (!target) throw new BusinessRuleViolationError("User not found in this organisation");
  if (target.role === "owner") {
    const ownerCount = await userRepo.countOwners(orgId);
    if (ownerCount <= 1) {
      throw new BusinessRuleViolationError("The last Owner cannot be deactivated");
    }
  }
  await userRepo.setActive(orgId, targetUserId, false);
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "user.deactivated",
    entityType: "user",
    entityId: targetUserId,
  });
}
