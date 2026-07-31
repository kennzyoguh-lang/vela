-- Phone+PIN staff auth (anti-theft/POS feature, Piece 1) — a second,
-- alternate credential on the same User identity, same shape as 2FA's
-- fields living directly on the table. email/password_hash become
-- nullable since a phone+PIN-only staff user never has them; the CHECK
-- constraint below enforces one identity pair or the other is always
-- present, never neither.
ALTER TABLE "users"
  ADD COLUMN "phone" CITEXT,
  ADD COLUMN "pin_hash" TEXT,
  ADD COLUMN "pin_device_id" TEXT,
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "password_hash" DROP NOT NULL;

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

ALTER TABLE "users" ADD CONSTRAINT "users_auth_identity_check" CHECK (
  (email IS NOT NULL AND password_hash IS NOT NULL) OR (phone IS NOT NULL AND pin_hash IS NOT NULL)
);
