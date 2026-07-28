import * as sessionRepo from "../repositories/session.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";

export async function listSessions(orgId: string, userId: string, currentSessionId: string) {
  const sessions = await sessionRepo.listActiveForUser(orgId, userId);
  return sessions.map((s) => ({
    id: s.id,
    deviceInfo: s.deviceInfo,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt,
    lastActive: s.lastActive,
    isCurrent: s.id === currentSessionId,
  }));
}

export async function terminate(orgId: string, actorId: string, sessionId: string) {
  await sessionRepo.terminateSession(orgId, sessionId);
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "session.terminated",
    entityType: "user_session",
    entityId: sessionId,
  });
}

export async function terminateAllOthers(orgId: string, userId: string, keepSessionId: string) {
  await sessionRepo.terminateAllExcept(orgId, userId, keepSessionId);
  await auditLogRepo.write({
    orgId,
    userId,
    action: "session.terminated_all_others",
    entityType: "user_session",
  });
}
