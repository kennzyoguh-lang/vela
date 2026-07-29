import * as organisationRepo from "../repositories/organisation.repository";
import * as userRepo from "../repositories/user.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { hashPassword, verifyPassword, hashToken, verifyTokenHash } from "./password.service";
import {
  signAccessToken,
  newRefreshToken,
  rotateRefreshToken,
  signTwoFaChallengeToken,
  verifyTwoFaChallengeToken,
} from "./jwt.service";
import { verifyTotpCode, consumeBackupCode, decryptTwoFaSecret } from "./twofa.service";
import { isTwoFaLockedOut, recordTwoFaFailure, clearTwoFaFailures } from "./rate-limit.service";
import { UnauthenticatedError, ConflictError } from "../lib/errors";
import type { SignupInput, LoginInput } from "../validation/auth.schema";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  orgId: string;
  userId: string;
  sessionFamilyId: string;
  role: string;
}

// A login attempt either succeeds outright (no 2FA, or already-verified) or
// pauses on a 2FA challenge — the two shapes are deliberately incompatible
// (no shared `accessToken` field) so a caller can't accidentally treat a
// pending challenge as an authenticated session.
export type LoginResult =
  | ({ requiresTwoFa: false } & AuthResult)
  | { requiresTwoFa: true; challengeToken: string; orgId: string; userId: string };

/**
 * Creates a new organisation and its first user (Owner). This is the one flow
 * in the system that runs before an org_id exists to scope by (Handbook 6.3's
 * RLS model applies from the first row onward). A fresh user never has 2FA
 * enabled yet (that's a separate, later enrollment flow), so this always
 * issues a full session.
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) throw new ConflictError("An account with this email already exists");

  const org = await organisationRepo.createOrganisation({
    name: input.orgName,
    country: input.country,
  });
  const passwordHash = await hashPassword(input.password);
  const user = await userRepo.createUser(org.id, {
    name: input.name,
    email: input.email,
    passwordHash,
    role: "owner",
  });
  await organisationRepo.setOrganisationOwner(org.id, user.id);

  return issueSession(org.id, user.id, "owner", {});
}

export async function login(
  input: LoginInput,
  meta: { deviceInfo?: string; ipAddress?: string },
): Promise<LoginResult> {
  const user = await userRepo.findByEmail(input.email);
  // Generic error regardless of which field was wrong — never reveal whether
  // the email exists (Handbook 3.12 / Design System 6.4).
  if (!user || !user.isActive) throw new UnauthenticatedError("Invalid email or password");
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthenticatedError("Invalid email or password");

  if (user.twoFaEnabled) {
    // No session is issued yet — issueSession() is not called here. The
    // challenge token is structurally incapable of being used as a real
    // access token (jwt.service.ts's verifyAccessToken rejects any `aud`
    // claim), so a stolen password alone still can't reach anything.
    const challengeToken = signTwoFaChallengeToken({ sub: user.id, orgId: user.orgId });
    return { requiresTwoFa: true, challengeToken, orgId: user.orgId, userId: user.id };
  }

  await userRepo.updateLastLogin(user.orgId, user.id);
  const session = await issueSession(user.orgId, user.id, user.role, meta);
  return { requiresTwoFa: false, ...session };
}

/**
 * Completes a login that paused on a 2FA challenge. Looks the user up via
 * findById (never findByEmail's SECURITY DEFINER lookup, which deliberately
 * doesn't return the encrypted secret or backup codes) using the claims from
 * the already-verified challenge token — the token's signature is what makes
 * that orgId/userId trustworthy here, not anything the client separately
 * asserts. Lockout is checked and recorded by userId, not by challenge token
 * or IP, so a stolen password can't be used to mint an unlimited supply of
 * fresh 5-attempt budgets (Handbook 7.5's brute-force-lockout precedent).
 */
export async function verifyTwoFaChallenge(
  challengeToken: string,
  code: string,
  meta: { deviceInfo?: string; ipAddress?: string },
): Promise<AuthResult> {
  let claims: { sub: string; orgId: string };
  try {
    claims = verifyTwoFaChallengeToken(challengeToken);
  } catch {
    throw new UnauthenticatedError("2FA challenge expired or invalid — log in again");
  }

  const user = await userRepo.findById(claims.orgId, claims.sub);
  if (!user || !user.isActive || !user.twoFaEnabled || !user.twoFaSecretEncrypted) {
    throw new UnauthenticatedError("2FA challenge invalid");
  }

  if (await isTwoFaLockedOut(user.id)) {
    throw new UnauthenticatedError("Too many failed attempts — try again in 15 minutes");
  }

  const secret = decryptTwoFaSecret(user.twoFaSecretEncrypted, user.id);
  let usedBackupCode = false;

  if (!verifyTotpCode(secret, code)) {
    const backupResult = await consumeBackupCode(code, user.backupCodesHash);
    if (!backupResult.matched) {
      await recordTwoFaFailure(user.id);
      await auditLogRepo.write({
        orgId: user.orgId,
        userId: user.id,
        action: "2fa.challenge_failed",
        entityType: "user",
        entityId: user.id,
      });
      throw new UnauthenticatedError("Invalid verification code");
    }
    usedBackupCode = true;
    await userRepo.updateBackupCodes(user.orgId, user.id, backupResult.remaining);
  }

  await clearTwoFaFailures(user.id);
  await auditLogRepo.write({
    orgId: user.orgId,
    userId: user.id,
    action: usedBackupCode ? "2fa.backup_code_used" : "2fa.challenge_succeeded",
    entityType: "user",
    entityId: user.id,
  });
  await userRepo.updateLastLogin(user.orgId, user.id);
  return issueSession(user.orgId, user.id, user.role, meta);
}

async function issueSession(
  orgId: string,
  userId: string,
  role: string,
  meta: { deviceInfo?: string; ipAddress?: string },
): Promise<AuthResult> {
  const { token: refreshToken, familyId } = newRefreshToken();
  const accessToken = signAccessToken({ sub: userId, orgId, role, sessionFamilyId: familyId });
  await sessionRepo.createSession(orgId, {
    userId,
    refreshTokenHash: await hashToken(refreshToken),
    sessionFamilyId: familyId,
    deviceInfo: meta.deviceInfo,
    ipAddress: meta.ipAddress,
  });
  return { accessToken, refreshToken, orgId, userId, sessionFamilyId: familyId, role };
}

/**
 * Refresh-token rotation: single-use, reuse of an already-rotated token
 * invalidates the entire session family (Handbook 7.5) — treated as a signal
 * of token theft, not a benign race condition.
 */
export async function refresh(
  orgId: string,
  sessionFamilyId: string,
  presentedToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const session = await sessionRepo.findActiveByFamily(orgId, sessionFamilyId);
  if (!session) throw new UnauthenticatedError("Session expired or revoked");

  const matches = await verifyTokenHash(presentedToken, session.refreshTokenHash);
  if (!matches) {
    await sessionRepo.terminateFamily(orgId, sessionFamilyId);
    throw new UnauthenticatedError("Refresh token reuse detected — session terminated");
  }

  const user = await userRepo.findById(orgId, session.userId);
  if (!user || !user.isActive) throw new UnauthenticatedError("Account no longer active");

  const nextRefreshToken = rotateRefreshToken();
  await sessionRepo.terminateSession(orgId, session.id);
  await sessionRepo.createSession(orgId, {
    userId: session.userId,
    refreshTokenHash: await hashToken(nextRefreshToken),
    sessionFamilyId,
    deviceInfo: session.deviceInfo ?? undefined,
    ipAddress: session.ipAddress ?? undefined,
  });

  const accessToken = signAccessToken({
    sub: user.id,
    orgId,
    role: user.role,
    sessionFamilyId,
  });
  return { accessToken, refreshToken: nextRefreshToken };
}

export async function logout(orgId: string, sessionFamilyId: string): Promise<void> {
  await sessionRepo.terminateFamily(orgId, sessionFamilyId);
}
