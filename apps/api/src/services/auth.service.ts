import * as organisationRepo from "../repositories/organisation.repository";
import * as userRepo from "../repositories/user.repository";
import * as sessionRepo from "../repositories/session.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as calculatorLeadService from "./calculator-lead.service";
import * as referralService from "./referral.service";
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

  // Best-effort resolve — an unrecognized or expired code, or any lookup
  // failure, must never block a real signup. Resolved once, here, and
  // stored on the org permanently (see Organisation.referredByOrgId's
  // schema comment) rather than re-resolved later.
  let referral: { orgId: string; codeId: string } | null = null;
  if (input.referredBy) {
    referral = await referralService.resolveCode(input.referredBy).catch(() => null);
  }

  const org = await organisationRepo.createOrganisation({
    name: input.orgName,
    country: input.country,
    referredByOrgId: referral?.orgId,
    referredByCodeId: referral?.codeId,
  });
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await userRepo.createUser(org.id, {
      name: input.name,
      email: input.email,
      passwordHash,
      role: "owner",
    });
  } catch (err) {
    // The findByEmail pre-check above only closes the common case — two
    // concurrent signups with the same email can both pass it and race to
    // the email @unique constraint, same belt-and-suspenders pattern as
    // organisation.service.ts#createStaffUser's phone uniqueness check.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new ConflictError("An account with this email already exists");
    }
    throw err;
  }
  await organisationRepo.setOrganisationOwner(org.id, user.id);

  // Best-effort: closes the FIRS-calculator lead loop (calculator-lead.
  // service.ts) if this signup came from that funnel. Never allowed to fail
  // the signup itself — a missed conversion mark is just a metric gap.
  calculatorLeadService.markConverted(input.email).catch(() => {});

  return issueSession(org.id, user.id, "owner", {});
}

export async function login(
  input: LoginInput,
  meta: { deviceInfo?: string; ipAddress?: string },
): Promise<LoginResult> {
  const user = await userRepo.findByEmail(input.email);
  // Generic error regardless of which field was wrong — never reveal whether
  // the email exists (Handbook 3.12 / Design System 6.4). A failure is only
  // audit-logged once the email resolves to a real user — audit_log requires
  // an org_id, and there's no org to attach an unknown-email attempt to
  // anyway; rate limiting (loginRateLimit) is the defense for that case.
  if (!user || !user.isActive) {
    if (user) {
      await auditLogRepo.write({
        orgId: user.orgId,
        userId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.deviceInfo,
      });
    }
    throw new UnauthenticatedError("Invalid email or password");
  }
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await auditLogRepo.write({
      orgId: user.orgId,
      userId: user.id,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.deviceInfo,
    });
    throw new UnauthenticatedError("Invalid email or password");
  }

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

// Exported so staff-auth.service.ts's phone+PIN login can mint an identical
// session/JWT shape without duplicating this logic — it only needs to
// resolve orgId/userId/role, same as every caller in this file already does.
export async function issueSession(
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
