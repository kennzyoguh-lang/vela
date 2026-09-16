-- Adds single-use enforcement for password-reset tokens (auth.service.ts
-- #resetPassword) — see schema.prisma's comment on User.passwordChangedAt
-- for why this column, not a separate Redis/jti denylist, closes the gap.
-- No RLS change needed: this is a plain column on an already-RLS-covered
-- table, not a new table.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMPTZ;
