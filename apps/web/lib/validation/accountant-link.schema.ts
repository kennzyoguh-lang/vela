import { z } from "zod";

// Mirrors apps/api/src/validation/accountant-link.schema.ts.
export const inviteAccountantSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export type InviteAccountantFormValues = z.infer<typeof inviteAccountantSchema>;
