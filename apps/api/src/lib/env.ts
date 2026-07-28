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
});

// Fails loud at boot (Handbook 1.4 "fail loud in development") rather than
// surfacing a confusing runtime error the first time a JWT is signed.
export const env = envSchema.parse(process.env);
