import { z } from "zod";

const providerSchema = z.enum(["quickbooks", "xero", "wave"]);

export const accountingProviderParamsSchema = z.object({
  provider: providerSchema,
});

export const accountingCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  realmId: z.string().optional(), // QuickBooks-specific
});
