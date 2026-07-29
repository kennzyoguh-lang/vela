import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  APP_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_PRIVATE_KEY_BASE64: z.string().min(1),
  JWT_PUBLIC_KEY_BASE64: z.string().min(1),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(3600),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  // Optional — payment gateway keys (Epic 5). The app boots and every non-
  // payment feature works without these (Handbook 1.4: "AI is a feature, not
  // a foundation" applies equally here — a missing Paystack key must never
  // block invoicing, payroll, or anything else). Attempting to actually
  // initialize a payment without one fails loudly at that call site instead.
  PAYSTACK_SECRET_KEY: z.string().optional(),
  WEB_APP_URL: z.string().default("http://localhost:3000"),
});

// Fails loud at boot (Handbook 1.4 "fail loud in development") rather than
// surfacing a confusing runtime error the first time a JWT is signed.
export const env = envSchema.parse(process.env);
