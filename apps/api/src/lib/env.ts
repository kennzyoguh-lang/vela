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
  // Optional, unlike the key above — org-supplied payment processor
  // credentials (an org connecting their own Paystack/Stripe account
  // instead of Vela's platform one) are an opt-in feature most orgs never
  // touch, not a mandatory security control every account goes through.
  // Unset means that one feature fails loudly at the call site
  // (payment-credential.service.ts) — the app boots and every existing
  // payment flow (Vela's own platform keys) works exactly as before.
  // 32 raw bytes, base64-encoded (AES-256-GCM key, lib/encryption.ts) — a
  // separate key from TWO_FA_ENCRYPTION_KEY_BASE64 so a compromise of one
  // doesn't also expose the other.
  PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64: z.string().optional(),
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
  // Optional — Resend (email provider), same "never blocks anything else"
  // contract as TERMII_API_KEY: unset means owner-summary/cash-check
  // notifications routed to email (business profiling's notification-channel
  // default, formal/semi-formal orgs) log an honest "[stub] would send"
  // instead of a real API call.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("Vela <notifications@vela.app>"),
  WEB_APP_URL: z.string().default("http://localhost:3000"),
  // Optional — encrypts an org's own accounting-app OAuth tokens
  // (org_accounting_connections table) at rest. Same "never blocks anything
  // else, separate key from every other encryption key" contract as
  // PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64 above.
  ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64: z.string().optional(),
  // Optional — QuickBooks/Xero OAuth app credentials (Handbook 1.4: a
  // missing developer-account credential must never block anything else).
  // Unset means accounting-connection.service.ts's isProviderConfigured()
  // reports the provider unavailable and the settings UI shows "Coming
  // soon" instead of a broken Connect button — see PaymentConnectorsCard's
  // identical treatment of flutterwave/stripe before those had real keys.
  QUICKBOOKS_CLIENT_ID: z.string().optional(),
  QUICKBOOKS_CLIENT_SECRET: z.string().optional(),
  QUICKBOOKS_REDIRECT_URI: z.string().optional(),
  XERO_CLIENT_ID: z.string().optional(),
  XERO_CLIENT_SECRET: z.string().optional(),
  XERO_REDIRECT_URI: z.string().optional(),
  // Optional — encrypts the Vela-generated webhook signing secret an org
  // uses to verify its own third-party payroll app's outbound deliveries
  // (org_payroll_export_configs table). Same isolation reasoning as every
  // other encryption key above: a missing key means only this one opt-in
  // feature fails loudly at its own call site (payroll-export.service.ts),
  // never anything else.
  PAYROLL_EXPORT_ENCRYPTION_KEY_BASE64: z.string().optional(),
  // Optional — encrypts the owner's NIN/BVN on file (organisation_kyc
  // table). Same isolation reasoning as every other encryption key above:
  // a missing key means only this one opt-in compliance feature fails
  // loudly at its own call site (kyc.service.ts), never anything else.
  KYC_ENCRYPTION_KEY_BASE64: z.string().optional(),
});

// Fails loud at boot (Handbook 1.4 "fail loud in development") rather than
// surfacing a confusing runtime error the first time a JWT is signed.
export const env = envSchema.parse(process.env);
