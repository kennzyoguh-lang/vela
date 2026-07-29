-- Security fix: the 2FA TOTP secret was stored as a one-way bcrypt hash
-- (two_fa_secret_hash), which can never be reversed to recompute an expected
-- TOTP code — meaning login-time 2FA verification was structurally
-- impossible. Replaced with a reversible, authenticated encryption column
-- (AES-256-GCM, see twofa.service.ts). No data migration: a previously
-- "hashed" secret was already useless for verification, so any already-
-- enrolled user re-enrolls 2FA.
ALTER TABLE "users" DROP COLUMN "two_fa_secret_hash",
ADD COLUMN     "two_fa_secret_encrypted" TEXT;
