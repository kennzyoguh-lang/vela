import { withOrgScope } from "../lib/prisma";
import type { UserSession } from "@prisma/client";

export async function createSession(
  orgId: string,
  input: {
    userId: string;
    refreshTokenHash: string;
    sessionFamilyId: string;
    deviceInfo?: string;
    ipAddress?: string;
  },
): Promise<UserSession> {
  return withOrgScope(orgId, (tx) =>
    tx.userSession.create({
      data: {
        orgId,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        sessionFamilyId: input.sessionFamilyId,
        deviceInfo: input.deviceInfo,
        ipAddress: input.ipAddress,
      },
    }),
  );
}

export async function findActiveByFamily(
  orgId: string,
  sessionFamilyId: string,
): Promise<UserSession | null> {
  return withOrgScope(orgId, (tx) =>
    tx.userSession.findFirst({
      where: { orgId, sessionFamilyId, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function listActiveForUser(orgId: string, userId: string): Promise<UserSession[]> {
  return withOrgScope(orgId, (tx) =>
    tx.userSession.findMany({
      where: { orgId, userId, isActive: true },
      orderBy: { lastActive: "desc" },
    }),
  );
}

export async function touchLastActive(orgId: string, sessionId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.userSession.update({ where: { id: sessionId, orgId }, data: { lastActive: new Date() } }),
  );
}

export async function terminateSession(orgId: string, sessionId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.userSession.update({ where: { id: sessionId, orgId }, data: { isActive: false } }),
  );
}

// Reuse of an already-rotated refresh token invalidates the whole session
// family (Handbook 7.5) — this is the "someone stole this refresh token" signal.
export async function terminateFamily(orgId: string, sessionFamilyId: string): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.userSession.updateMany({ where: { orgId, sessionFamilyId }, data: { isActive: false } }),
  );
}

export async function terminateAllExcept(
  orgId: string,
  userId: string,
  keepSessionId: string,
): Promise<void> {
  await withOrgScope(orgId, (tx) =>
    tx.userSession.updateMany({
      where: { orgId, userId, id: { not: keepSessionId } },
      data: { isActive: false },
    }),
  );
}
