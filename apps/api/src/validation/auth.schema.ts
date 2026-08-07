import { z } from "zod";

// Shared with the frontend (apps/web/lib/validation) once the OpenAPI generator
// exists (Handbook 4.7/7.8) — Foundation defines these once, here, and the web
// app imports the same schema rather than re-declaring it.
export const signupSchema = z.object({
  orgName: z.string().min(2).max(120),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  country: z.string().length(2).default("NG"),
  // GTM Channel 3 — set when arriving from a /refer/[code] link. Resolved
  // server-side (referral.service.ts#resolveCode) into the referrer's org
  // id, never trusted or stored as-is; an unrecognized code is silently
  // ignored rather than failing the signup.
  referredBy: z.string().max(20).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const twoFaVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

export const twoFaChallengeSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(10),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "accountant", "staff", "view_only"]),
});

// Phone+PIN staff login (anti-theft/POS feature) — deviceId is a stable
// client-generated identifier (see apps/web's device-id helper), sent on
// every login attempt so the server can enforce trust-on-first-use device
// binding (staff-auth.service.ts#loginWithPin).
export const phoneLoginSchema = z.object({
  phone: z.string().min(7).max(20),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
  deviceId: z.string().min(1),
});

// Owner adding a sales-staff member — no email/password by design, matching
// the phone+PIN login path this account will use. `pin` is optional: the
// anti-theft Piece 5 "visual, not text-heavy" setup flow never shows a PIN
// field at all (organisation.service.ts#createStaffUser generates one and
// returns it once) — an owner-chosen PIN stays supported for API callers
// that want it (existing tests all set one explicitly).
export const createStaffSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
  role: z.enum(["admin", "accountant", "staff", "view_only"]).default("staff"),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN must be 4-6 digits")
    .optional(),
});

// Anti-theft Piece 4 — owner/admin sets the org's shared discount-approval PIN.
export const setDiscountApprovalPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

// The current owner/admin's own SMS notification number (daily summary,
// cash-check mismatch alerts) — distinct from a staff member's phone+PIN
// login credential, hence "notification" in the name and route rather than
// a generic "phone" that could be confused with the auth field.
export const setNotificationPhoneSchema = z.object({
  phone: z.string().min(7).max(20),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
