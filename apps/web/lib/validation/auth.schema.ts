import { z } from "zod";

// Mirrors apps/api/src/validation/auth.schema.ts — until the OpenAPI-generated
// shared schema pipeline exists (Handbook 4.7), this is hand-kept in sync.
// A drift between these two is exactly the bug class that pipeline exists to
// eliminate; flag it in code review until then.
export const signupSchema = z.object({
  orgName: z.string().min(2, "Business name is required").max(120),
  name: z.string().min(1, "Your name is required").max(120),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(10, "At least 10 characters"),
  country: z.string().length(2).default("NG"),
  // Carried through from ?referredBy= (GTM Channel 3's /refer/[code] and
  // FIRS-calculator-style funnels) — never a visible form field.
  referredBy: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(10, "At least 10 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RequestPasswordResetFormValues = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
