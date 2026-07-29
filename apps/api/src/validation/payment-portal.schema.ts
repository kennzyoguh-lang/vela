import { z } from "zod";

export const initiatePaymentSchema = z.object({
  payerEmail: z.string().email(),
});
