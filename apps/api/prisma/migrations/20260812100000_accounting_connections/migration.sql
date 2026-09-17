-- Bring-your-own accounting app (QuickBooks/Xero/Wave) — one-way (Vela ->
-- provider) invoice push. access_token_encrypted/refresh_token_encrypted are
-- always AES-256-GCM ciphertext (lib/encryption.ts); the plaintext OAuth
-- tokens are never written to this table or logged anywhere.

-- CreateEnum
CREATE TYPE "accounting_provider" AS ENUM ('quickbooks', 'xero', 'wave');

-- CreateTable
CREATE TABLE "org_accounting_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "provider" "accounting_provider" NOT NULL,
    "external_tenant_id" TEXT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "token_expires_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMPTZ,
    "last_sync_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_accounting_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_accounting_connections_org_id_provider_key" ON "org_accounting_connections"("org_id", "provider");

-- AddForeignKey
ALTER TABLE "org_accounting_connections" ADD CONSTRAINT "org_accounting_connections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "invoice_accounting_syncs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" "accounting_provider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_accounting_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_accounting_syncs_invoice_id_provider_key" ON "invoice_accounting_syncs"("invoice_id", "provider");

-- AddForeignKey
ALTER TABLE "invoice_accounting_syncs" ADD CONSTRAINT "invoice_accounting_syncs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_accounting_syncs" ADD CONSTRAINT "invoice_accounting_syncs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
