-- Bring-your-own payment processor credentials (schema.prisma's comment on
-- OrgPaymentCredential explains the feature). secret_key_encrypted is
-- always AES-256-GCM ciphertext (lib/encryption.ts) — the plaintext
-- secret key is never written to this table or logged anywhere.

-- CreateTable
CREATE TABLE "org_payment_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "processor" "payment_processor" NOT NULL,
    "secret_key_encrypted" TEXT NOT NULL,
    "public_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_payment_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_payment_credentials_org_id_processor_key" ON "org_payment_credentials"("org_id", "processor");

-- AddForeignKey
ALTER TABLE "org_payment_credentials" ADD CONSTRAINT "org_payment_credentials_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
