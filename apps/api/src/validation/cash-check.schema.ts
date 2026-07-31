import { z } from "zod";

export const submitCashCheckSchema = z.object({
  countedAmount: z.number().nonnegative(),
});

export type SubmitCashCheckInput = z.infer<typeof submitCashCheckSchema>;
