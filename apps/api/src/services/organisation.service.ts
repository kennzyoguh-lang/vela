import { randomInt } from "node:crypto";
import * as inviteRepo from "../repositories/invite.repository";
import * as userRepo from "../repositories/user.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as complianceObligationRepo from "../repositories/compliance-obligation.repository";
import * as bankAccountRepo from "../repositories/bank-account.repository";
import { hashPassword } from "./password.service";
import { normalizePhoneNumber } from "../lib/phone";
import { BusinessRuleViolationError, ConflictError } from "../lib/errors";
import type { Role } from "@prisma/client";
import type { CreateStaffInput } from "../validation/auth.schema";

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

// Sanitized shape returned to the client — never the raw Prisma User row,
// which carries pinHash/pinDeviceId. No existing endpoint returns a raw
// User row today, so there's no shape to reuse here; this is a new,
// deliberate exclusion.
export interface StaffUserSummary {
  id: string;
  name: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  // Only present when the PIN was server-generated (input.pin omitted) —
  // this is the ONE moment it's ever visible in plaintext, matching how
  // backup codes/API keys are shown once at creation and never again. An
  // owner-supplied PIN is never echoed back — they already know it.
  generatedPin?: string;
}

function generateStaffPin(): string {
  return String(randomInt(1000, 10000)); // 4-digit, "0"-prefixed values excluded on purpose (10000 not 9999)
}

/**
 * Owner/admin adds a sales-staff member — phone+PIN, not email+password
 * (Anti-theft/POS feature). Synchronous, unlike inviteUser above: there's
 * no accept-invite step, since sales staff won't have email-based
 * onboarding at all.
 *
 * Anti-theft Piece 5's "visual, not text-heavy" setup flow never shows a
 * PIN input at all — when input.pin is omitted, one is generated here and
 * returned once so the owner can hand it to the new staff member.
 */
export async function createStaffUser(
  orgId: string,
  actorId: string,
  input: CreateStaffInput,
): Promise<StaffUserSummary> {
  const phone = normalizePhoneNumber(input.phone);
  const existing = await userRepo.findByPhone(phone);
  if (existing) throw new ConflictError("This phone number is already registered");

  const generatedPin = input.pin ? undefined : generateStaffPin();
  const pinHash = await hashPassword(input.pin ?? generatedPin!);
  let user;
  try {
    user = await userRepo.createStaffUser(orgId, {
      name: input.name,
      phone,
      role: input.role,
      pinHash,
    });
  } catch (err) {
    // The findByPhone pre-check above only returns a hit for a row that
    // already has a PIN set — belt-and-suspenders against the (should never
    // happen) case of a phone stored without one, the DB's own unique
    // constraint is the real guarantee.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new ConflictError("This phone number is already registered");
    }
    throw err;
  }

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "staff.created",
    entityType: "user",
    entityId: user.id,
    newValue: { phone, role: input.role },
  });

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    generatedPin,
  };
}

/**
 * Anti-theft Piece 4's discount-approval guardrail — owner/admin sets a
 * shared PIN a staff member asks them to type in on the same device before
 * a discount goes through. Reuses hashPassword (same bcrypt cost as staff
 * login PINs) rather than inventing a separate hashing path.
 */
export async function setDiscountApprovalPin(orgId: string, actorId: string, pin: string) {
  const pinHash = await hashPassword(pin);
  await organisationRepo.setDiscountApprovalPinHash(orgId, pinHash);
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "organisation.discount_approval_pin_set",
    entityType: "organisation",
    entityId: orgId,
  });
}

/**
 * The current owner/admin's own SMS notification number — where the daily
 * summary and cash-check mismatch alerts (owner-summary.service.ts,
 * cash-check.service.ts) actually get sent. Distinct from a staff member's
 * phone+PIN login credential (Piece 1): this never touches pinHash, so
 * setting it can't accidentally grant or alter PIN login for the caller.
 */
export async function setNotificationPhone(orgId: string, actorId: string, rawPhone: string) {
  const phone = normalizePhoneNumber(rawPhone);
  const existing = await userRepo.findByPhone(phone);
  if (existing && existing.id !== actorId) {
    throw new ConflictError("This phone number is already registered to another account");
  }

  try {
    await userRepo.updateNotificationPhone(orgId, actorId, phone);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new ConflictError("This phone number is already registered to another account");
    }
    throw err;
  }

  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "user.notification_phone_set",
    entityType: "user",
    entityId: actorId,
  });
}

// Owner-side "staff got a new phone" recovery — clears the trust-on-first-
// use device binding so the next successful PIN login re-binds cleanly.
export async function resetStaffDevice(orgId: string, actorId: string, targetUserId: string) {
  const target = await userRepo.findById(orgId, targetUserId);
  if (!target) throw new BusinessRuleViolationError("User not found in this organisation");
  await userRepo.resetPinDevice(orgId, targetUserId);
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "staff.device_reset",
    entityType: "user",
    entityId: targetUserId,
  });
}

export interface SetupChecklist {
  complianceObligationsSelected: boolean;
  bankAccountConnected: boolean;
  teamInvited: boolean;
}

// Backs the dashboard's "Get set up" first-run checklist
// (apps/web/app/(dashboard)/page.tsx#FirstRunChecklist) — all 3 booleans are
// computed on read from data that already exists elsewhere, not cached or
// stored, same derive-don't-cache precedent used throughout this codebase.
// "Team invited" counts either a still-pending invite or an already-active
// second user (an accepted invite becomes a user row; a phone+PIN staff
// account created via createStaffUser never goes through the invite table at
// all) — either one means the owner is no longer working alone.
export async function getSetupChecklist(orgId: string): Promise<SetupChecklist> {
  const [obligations, bankAccounts, pendingInvites, users] = await Promise.all([
    complianceObligationRepo.listActive(orgId),
    bankAccountRepo.listActiveByOrg(orgId),
    inviteRepo.listPendingForOrg(orgId),
    userRepo.listByOrg(orgId),
  ]);
  return {
    complianceObligationsSelected: obligations.length > 0,
    bankAccountConnected: bankAccounts.length > 0,
    teamInvited: pendingInvites.length > 0 || users.length > 1,
  };
}
