-- Generic, provider-agnostic payroll export — Vela signs and delivers an
-- outbound webhook to a URL the org supplies, rather than authenticating
-- into any specific payroll app (schema.prisma's comment on
-- OrgPayrollExportConfig explains why). webhook_secret_encrypted is always
-- AES-256-GCM ciphertext (lib/encryption.ts); the plaintext secret is
-- generated once, shown to the org exactly once, and never written to this
-- table or logged anywhere in plaintext.

-- CreateTable
CREATE TABLE "org_payroll_export_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "webhook_url" TEXT NOT NULL,
    "webhook_secret_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_delivery_at" TIMESTAMPTZ,
    "last_delivery_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_payroll_export_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_payroll_export_configs_org_id_key" ON "org_payroll_export_configs"("org_id");

-- AddForeignKey
ALTER TABLE "org_payroll_export_configs" ADD CONSTRAINT "org_payroll_export_configs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
