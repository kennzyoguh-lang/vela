-- KYC — the owner's NIN/BVN on file for the business. nin_encrypted/
-- bvn_encrypted are always AES-256-GCM ciphertext (lib/encryption.ts); the
-- plaintext values are never written to this table or logged anywhere.

-- CreateTable
CREATE TABLE "organisation_kyc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "nin_encrypted" TEXT,
    "bvn_encrypted" TEXT,
    "nin_submitted_at" TIMESTAMPTZ,
    "bvn_submitted_at" TIMESTAMPTZ,
    "nin_verified_at" TIMESTAMPTZ,
    "bvn_verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisation_kyc_org_id_key" ON "organisation_kyc"("org_id");

-- AddForeignKey
ALTER TABLE "organisation_kyc" ADD CONSTRAINT "organisation_kyc_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
