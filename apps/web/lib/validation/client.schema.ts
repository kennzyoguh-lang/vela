import { z } from "zod";

// Mirrors apps/api/src/validation/client.schema.ts (Handbook 4.7 pattern).
export const createClientSchema = z.object({
  name: z.string().min(1, "Client name is required").max(200),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  paymentTerms: z.coerce.number().int().min(0).max(365).default(14),
});

export type CreateClientFormValues = z.infer<typeof createClientSchema>;
