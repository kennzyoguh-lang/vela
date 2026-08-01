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
  // Required, not optional — 2FA is a core Foundation security feature
  // (mandatory for Owner), not a third-party integration like Paystack/Mono/
  // Anthropic, so a missing key fails loud at boot rather than silently
  // degrading. 32 raw bytes, base64-encoded (AES-256-GCM key).
  TWO_FA_ENCRYPTION_KEY_BASE64: z.string().min(1),
  // Optional — payment gateway keys (Epic 5). The app boots and every non-
  // payment feature works without these (Handbook 1.4: "AI is a feature, not
  // a foundation" applies equally here — a missing Paystack key must never
  // block invoicing, payroll, or anything else). Attempting to actually
  // initialize a payment without one fails loudly at that call site instead.
  PAYSTACK_SECRET_KEY: z.string().optional(),
  // Optional — bank-sync provider key (Phase 4). Same "never blocks anything
  // else" contract as PAYSTACK_SECRET_KEY: unset means linking/syncing a
  // bank account fails loudly at that call site, not at boot.
  MONO_SECRET_KEY: z.string().optional(),
  // Optional — Ask Vela's LLM provider key (Phase 7). Same "never blocks
  // anything else" contract: unset means the app boots and every other
  // module works, but Ask Vela itself fails loudly at the call site
  // (Handbook 1.4 — "AI is a feature, not a foundation").
  ANTHROPIC_API_KEY: z.string().optional(),
  // Optional — Termii (SMS/WhatsApp provider, Nigeria-focused). Same "never
  // blocks anything else" contract: unset means owner-summary/cash-check/
  // Quick-Sale-SMS notifications log an honest "[stub] would send" instead
  // of a real API call, they never fail loudly or block the primary action
  // that triggered them (submitting a cash check, creating a Quick Sale).
  TERMII_API_KEY: z.string().optional(),
  // Termii requires a registered alphanumeric sender ID for production SMS —
  // this default is a placeholder until the account owner registers one.
  TERMII_SENDER_ID: z.string().default("Vela"),
  WEB_APP_URL: z.string().default("http://localhost:3000"),
});

// Fails loud at boot (Handbook 1.4 "fail loud in development") rather than
// surfacing a confusing runtime error the first time a JWT is signed.
export const env = envSchema.parse(process.env);
