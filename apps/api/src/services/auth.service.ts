import * as organisationRepo from "../repositories/organisation.repository";
import * as userRepo from "../repositories/user.repository";
import * as sessionRepo from "../repositories/session.repository";
import { hashPassword, verifyPassword, hashToken, verifyTokenHash } from "./password.service";
import { signAccessToken, newRefreshToken, rotateRefreshToken } from "./jwt.service";
import { UnauthenticatedError, ConflictError } from "../lib/errors";
import type { SignupInput, LoginInput } from "../validation/auth.schema";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  orgId: string;
  userId: string;
  role: string;
  requiresTwoFa: boolean;
}

/**
 * Creates a new organisation and its first user (Owner). This is the one flow
 * in the system that runs before an org_id exists to scope by (Handbook 6.3's
 * RLS model applies from the first row onward).
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

  return issueSession(org.id, user.id, "owner", user.twoFaEnabled, {});
}

export async function login(
  input: LoginInput,
  meta: { deviceInfo?: string; ipAddress?: string },
): Promise<AuthResult> {
  const user = await userRepo.findByEmail(input.email);
  // Generic error regardless of which field was wrong — never reveal whether
  // the email exists (Handbook 3.12 / Design System 6.4).
  if (!user || !user.isActive) throw new UnauthenticatedError("Invalid email or password");
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthenticatedError("Invalid email or password");

  await userRepo.updateLastLogin(user.orgId, user.id);
  return issueSession(user.orgId, user.id, user.role, user.twoFaEnabled, meta);
}

async function issueSession(
  orgId: string,
  userId: string,
  role: string,
  requiresTwoFa: boolean,
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
  return { accessToken, refreshToken, orgId, userId, role, requiresTwoFa };
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
