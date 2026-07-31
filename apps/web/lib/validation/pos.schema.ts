import { z } from "zod";

// Mirrors apps/api/src/validation/auth.schema.ts's phoneLoginSchema — see
// that file's comment on hand-keeping these in sync until the OpenAPI
// pipeline exists.
export const phoneLoginSchema = z.object({
  phone: z.string().min(7, "Enter a valid phone number"),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

export type PhoneLoginFormValues = z.infer<typeof phoneLoginSchema>;
