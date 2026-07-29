import { z } from "zod";

// Mirrors apps/web/lib/validation/accountant-link.schema.ts.
export const inviteAccountantSchema = z.object({
  email: z.string().email(),
});

export type InviteAccountantInput = z.infer<typeof inviteAccountantSchema>;
