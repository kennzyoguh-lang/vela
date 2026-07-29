-- CreateEnum
CREATE TYPE "accountant_link_status" AS ENUM ('pending', 'active', 'revoked');

-- CreateTable
CREATE TABLE "accountant_client_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "accountant_email" CITEXT NOT NULL,
    "accountant_user_id" UUID,
    "status" "accountant_link_status" NOT NULL DEFAULT 'pending',
    "invited_by" UUID NOT NULL,
    "invited_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "accountant_client_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accountant_client_links_org_id_accountant_email_key" ON "accountant_client_links"("org_id", "accountant_email");

-- AddForeignKey
ALTER TABLE "accountant_client_links" ADD CONSTRAINT "accountant_client_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountant_client_links" ADD CONSTRAINT "accountant_client_links_accountant_user_id_fkey" FOREIGN KEY ("accountant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

