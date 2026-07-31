import * as userRepo from "../repositories/user.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { verifyPassword } from "./password.service";
import { issueSession, type AuthResult } from "./auth.service";
import { isPinLockedOut, recordPinFailure, clearPinFailures } from "./rate-limit.service";
import { normalizePhoneNumber } from "../lib/phone";
import { UnauthenticatedError } from "../lib/errors";
import type { PhoneLoginInput } from "../validation/auth.schema";

/**
 * Sales-staff login: phone + PIN + device binding, alongside the existing
 * email+password(+2FA) path for owners/admins. Reuses issueSession as-is
 * (Handbook — same session/JWT shape regardless of which login path
 * produced it), so RBAC and every other downstream check works unchanged.
 *
 * Device binding is trust-on-first-use: a user's first successful PIN login
 * binds pinDeviceId; every login after must come from that same device.
 * This is what actually closes the "PIN alone is weak" gap — a leaked PIN
 * still can't be used from an attacker's own device. Reset via the
 * owner-only reset-device endpoint (organisation.service.ts) if a staff
 * member's device changes.
 */
export async function loginWithPin(
  input: PhoneLoginInput,
  meta: { deviceInfo?: string; ipAddress?: string },
): Promise<AuthResult> {
  const phone = normalizePhoneNumber(input.phone);
  const user = await userRepo.findByPhone(phone);
  // Generic error regardless of which check failed — never reveal whether
  // the phone number exists, same posture as email+password login.
  if (!user || !user.isActive) throw new UnauthenticatedError("Invalid phone number or PIN");

  if (await isPinLockedOut(user.id)) {
    throw new UnauthenticatedError("Too many failed attempts — try again in 15 minutes");
  }

  const validPin = await verifyPassword(input.pin, user.pinHash);
  if (!validPin) {
    await recordPinFailure(user.id);
    await auditLogRepo.write({
      orgId: user.orgId,
      userId: user.id,
      action: "auth.pin_login_failed",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.deviceInfo,
    });
    throw new UnauthenticatedError("Invalid phone number or PIN");
  }

  if (!user.pinDeviceId) {
    // First successful login from any device — bind it.
    await userRepo.bindPinDevice(user.orgId, user.id, input.deviceId);
  } else if (user.pinDeviceId !== input.deviceId) {
    // Correct phone+PIN, wrong device. Recorded against the same lockout
    // counter as a wrong PIN (both are failed authentication attempts), but
    // audit-logged as a distinct action — this is very plausibly "staff got
    // a new phone," not necessarily an attack, and the owner needs to be
    // able to tell the difference. The clearer error message (vs. the
    // generic one above) is deliberate: the audience here is this
    // business's own staff, not the general public, and a generic message
    // would leave a non-technical trader with no path forward.
    await recordPinFailure(user.id);
    await auditLogRepo.write({
      orgId: user.orgId,
      userId: user.id,
      action: "auth.pin_login_device_mismatch",
      entityType: "user",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.deviceInfo,
    });
    throw new UnauthenticatedError(
      "This device isn't registered for this account — ask your manager to reset it",
    );
  }

  await clearPinFailures(user.id);
  await userRepo.updateLastLogin(user.orgId, user.id);
  const session = await issueSession(user.orgId, user.id, user.role, meta);
  await auditLogRepo.write({
    orgId: user.orgId,
    userId: user.id,
    action: "auth.pin_login_succeeded",
    entityType: "user",
    entityId: user.id,
  });
  return session;
}
