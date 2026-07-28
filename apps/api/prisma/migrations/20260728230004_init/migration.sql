-- CreateEnum
CREATE TYPE "role" AS ENUM ('owner', 'admin', 'accountant', 'staff', 'view_only');

-- CreateEnum
CREATE TYPE "subscription_tier" AS ENUM ('starter', 'growth', 'enterprise', 'corporate');

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "base_currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "country" TEXT NOT NULL DEFAULT 'NG',
    "registration_number" TEXT,
    "tax_id" TEXT,
    "subscription_tier" "subscription_tier" NOT NULL DEFAULT 'starter',
    "subscription_status" TEXT NOT NULL DEFAULT 'trialing',
    "owner_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'staff',
    "two_fa_secret_hash" TEXT,
    "two_fa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "backup_codes_hash" TEXT[],
    "last_login" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "session_family_id" UUID NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE INDEX "user_sessions_org_id_idx" ON "user_sessions"("org_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "organisation_invites_org_id_idx" ON "organisation_invites"("org_id");

-- CreateIndex
CREATE INDEX "audit_log_org_id_created_at_idx" ON "audit_log"("org_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_invites" ADD CONSTRAINT "organisation_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

