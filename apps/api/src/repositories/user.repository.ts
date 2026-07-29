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
