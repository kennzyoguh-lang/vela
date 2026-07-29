import { z } from "zod";

// Mirrors apps/web/lib/validation/ask-vela.schema.ts.
export const sendAskVelaMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export type SendAskVelaMessageInput = z.infer<typeof sendAskVelaMessageSchema>;
