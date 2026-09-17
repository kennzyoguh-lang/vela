import { z } from "zod";

const processorSchema = z.enum(["paystack", "flutterwave", "stripe"]);

export const connectPaymentCredentialSchema = z.object({
  processor: processorSchema,
  secretKey: z.string().min(1),
  publicKey: z.string().optional(),
});

export const disconnectPaymentCredentialParamsSchema = z.object({
  processor: processorSchema,
});

export type ConnectPaymentCredentialInput = z.infer<typeof connectPaymentCredentialSchema>;
