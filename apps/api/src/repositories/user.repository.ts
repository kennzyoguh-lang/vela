import { prisma, withOrgScope } from "../lib/prisma";
import type { Role, User } from "@prisma/client";

export interface AuthLookupUser {
  id: string;
  orgId: string;
  passwordHash: string;
  role: Role;
  twoFaEnabled: boolean;
  isActive: boolean;
}

/**
 * Looks a user up by email across all organisations — the one query in the
 * codebase that structurally cannot be org-scoped, because org context doesn't
 * exist yet at login time. It goes through `auth_lookup_user_by_email`, a
 * narrowly-scoped SECURITY DEFINER Postgres function (rls-and-security.sql.template)
 * rather than a direct table SELECT, so RLS on `users` still has "no exceptions"
 * at the table level (Handbook 6.3) — only this one function, granted to the
 * API's role for exactly this purpose, can look across tenants.
 */
export async function findByEmail(email: string): Promise<AuthLookupUser | null> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      org_id: string;
      password_hash: string;
      role: Role;
      two_fa_enabled: boolean;
      is_active: boolean;
    }[]
  >`SELECT * FROM auth_lookup_user_by_email(${email}::citext)`;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    passwordHash: row.password_hash,
    role: row.role,
    twoFaEnabled: row.two_fa_enabled,
    isActive: row.is_active,
  };
}

// Every method below takes orgId as an explicit, required first parameter —
// never optional, never inferred (Handbook 5.4) — and runs inside withOrgScope
// so the database-level RLS guarantee (Handbook 6.3) backs the application-level
// WHERE clause, not the other way around.
export async function findById(orgId: string, userId: string): Promise<User | null> {
  return withOrgScope(orgId, (tx) => tx.user.findFirst({ where: { id: userId, orgId } }));
}

export async function createUser(
  orgId: string,
  input: { name: string; email: string; passwordHash: string; role: Role },
): Promise<User> {
  return withOrgScope(orgId, (tx) =>
    tx.user.create({
      data: {
        orgId,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
      },
    }),
  );
}

export async function listByOrg(orgId: string): Promise<User[]> {
  return withOrgScope(orgId, (tx) =>
    tx.user.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
  );
}

export async function markEmailVerified(orgId: string, userId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { emailVerifiedAt: new Date() } }),
  );
}

export async function updateLastLogin(orgId: string, userId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { lastLogin: new Date() } }),
  );
}

export async function setTwoFa(
  orgId: string,
  userId: string,
  input: { secretEncrypted: string; backupCodesHash: string[] },
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({
      where: { id: userId, orgId },
      data: {
        twoFaSecretEncrypted: input.secretEncrypted,
        twoFaEnabled: true,
        backupCodesHash: input.backupCodesHash,
      },
    }),
  );
}

export async function updateBackupCodes(
  orgId: string,
  userId: string,
  backupCodesHash: string[],
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { backupCodesHash } }),
  );
}

export async function updateRole(orgId: string, userId: string, role: Role): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { role } }),
  );
}

export async function setActive(orgId: string, userId: string, isActive: boolean): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { isActive } }),
  );
}

export async function countOwners(orgId: string): Promise<number> {
  return withOrgScope(orgId, (tx) =>
    tx.user.count({ where: { orgId, role: "owner", isActive: true } }),
  );
}

// Business profiling's graduation prompts (piece 4) — "a 2nd staff account
// created while hasSalesStaff=no" specifically means POS staff (role
// "staff"), not admin/accountant/view_only — those roles don't hand out
// PIN logins for cash-handling, so their presence doesn't contradict a
// "no sales staff" answer the way a staff account does.
export async function countActiveStaffRole(orgId: string): Promise<number> {
  return withOrgScope(orgId, (tx) =>
    tx.user.count({ where: { orgId, role: "staff", isActive: true } }),
  );
}

// Owner-summary/cash-check SMS notifications go to every owner/admin who's
// bothered to set a notification phone — not just Organisation.ownerId — so
// a shop where an admin handles day-to-day operations still gets alerted.
export async function findNotifiablePhones(orgId: string): Promise<string[]> {
  const users = await withOrgScope(orgId, (tx) =>
    tx.user.findMany({
      where: { orgId, role: { in: ["owner", "admin"] }, isActive: true, phone: { not: null } },
      select: { phone: true },
    }),
  );
  return users.map((u) => u.phone as string);
}

export interface NotifiableRecipient {
  phone: string | null;
  email: string | null;
}

// Business profiling's notification-channel default (computeNotificationChannelDefault
// in @vela/types) picks email vs. WhatsApp/SMS per org — callers that need to
// route accordingly (owner-summary, cash-check alerts) use this instead of
// findNotifiablePhones, so a formal/CAC-registered org's owner/admin without a
// notification phone set still gets reached via their signup email.
export async function findNotifiableRecipients(orgId: string): Promise<NotifiableRecipient[]> {
  return withOrgScope(orgId, (tx) =>
    tx.user.findMany({
      where: { orgId, role: { in: ["owner", "admin"] }, isActive: true },
      select: { phone: true, email: true },
    }),
  );
}

// The current owner/admin's own SMS notification number — distinct from a
// staff member's phone+PIN login credential (Piece 1). Setting this never
// touches pinHash, so it can't accidentally grant or alter PIN login.
export async function updateNotificationPhone(
  orgId: string,
  userId: string,
  phone: string,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { phone } }),
  );
}

export interface PinAuthLookupUser {
  id: string;
  orgId: string;
  pinHash: string;
  pinDeviceId: string | null;
  role: Role;
  isActive: boolean;
}

/**
 * Phone+PIN staff login's equivalent of findByEmail above — same structural
 * reason (no org context yet at login time), same SECURITY DEFINER escape
 * hatch (auth_lookup_user_by_phone), same "RLS on `users` has no exceptions
 * at the table level" guarantee. Returns null for a user with no PIN set
 * (an email+password-only user's row has phone/pin_hash both null).
 */
export async function findByPhone(phone: string): Promise<PinAuthLookupUser | null> {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      org_id: string;
      pin_hash: string | null;
      pin_device_id: string | null;
      role: Role;
      is_active: boolean;
    }[]
  >`SELECT * FROM auth_lookup_user_by_phone(${phone}::citext)`;
  const row = rows[0];
  if (!row || !row.pin_hash) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    pinHash: row.pin_hash,
    pinDeviceId: row.pin_device_id,
    role: row.role,
    isActive: row.is_active,
  };
}

export async function createStaffUser(
  orgId: string,
  input: { name: string; phone: string; role: Role; pinHash: string },
): Promise<User> {
  return withOrgScope(orgId, (tx) =>
    tx.user.create({
      data: {
        orgId,
        name: input.name,
        phone: input.phone,
        pinHash: input.pinHash,
        role: input.role,
      },
    }),
  );
}

// Trust-on-first-use — called once, the first time a phone+PIN login
// succeeds from a device with no prior binding. Never called again for that
// user afterward; a mismatched deviceId on a later login is a rejection,
// not a re-bind (see staff-auth.service.ts#loginWithPin).
export async function bindPinDevice(
  orgId: string,
  userId: string,
  deviceId: string,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { pinDeviceId: deviceId } }),
  );
}

// Owner-side "staff got a new phone" recovery — clears the binding so the
// next successful login re-binds via trust-on-first-use again.
export async function resetPinDevice(orgId: string, userId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.user.update({ where: { id: userId, orgId }, data: { pinDeviceId: null } }),
  );
}
