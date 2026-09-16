-- F-57: Quotes/Estimates schema. Hand-written to match Prisma's own generated
-- shape exactly (see smartinvoice_schema's header note on why this project's
-- migrations aren't always produced by `prisma migrate dev` directly).

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');

-- CreateTable
CREATE TABLE "quote_number_counters" (
    "org_id" UUID NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "quote_number_counters_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "line_items" JSONB NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "quote_status" NOT NULL DEFAULT 'draft',
    "valid_until" DATE NOT NULL,
    "portal_token" TEXT NOT NULL,
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ,
    "responded_at" TIMESTAMPTZ,
    "decline_reason" TEXT,
    "converted_invoice_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotes_portal_token_key" ON "quotes"("portal_token");

-- CreateIndex
CREATE INDEX "quotes_org_id_status_valid_until_idx" ON "quotes"("org_id", "status", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_org_id_number_key" ON "quotes"("org_id", "number");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- convertedInvoiceId is a plain scalar in schema.prisma (no Prisma @relation,
-- see the model's comment) but still gets a real DB-level FK for referential
-- integrity — ON DELETE SET NULL, not CASCADE/RESTRICT: an invoice being
-- deleted must never cascade-delete or block deleting the quote that led to
-- it, since the quote's own history is independently meaningful.
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_invoice_id_fkey" FOREIGN KEY ("converted_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
