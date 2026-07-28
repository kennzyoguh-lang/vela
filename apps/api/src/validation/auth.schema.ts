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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
