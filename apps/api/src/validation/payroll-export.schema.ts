import { z } from "zod";

export const configurePayrollExportSchema = z.object({
  webhookUrl: z.string().url().max(2048),
});
