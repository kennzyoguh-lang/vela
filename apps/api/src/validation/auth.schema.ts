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
// the phone+PIN login path this account will use.
export const createStaffSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
  role: z.enum(["admin", "accountant", "staff", "view_only"]).default("staff"),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
