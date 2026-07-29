-- CreateEnum
CREATE TYPE "compliance_obligation_type" AS ENUM ('vat', 'paye', 'pension', 'wht', 'cit', 'cac_annual_return');

-- CreateEnum
CREATE TYPE "compliance_frequency" AS ENUM ('monthly', 'annual');

-- CreateTable
CREATE TABLE "org_compliance_obligations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "obligation_type" "compliance_obligation_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_compliance_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_filings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "obligation_type" "compliance_obligation_type" NOT NULL,
    "period_label" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "filed_at" TIMESTAMPTZ,
    "receipt_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_filings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_compliance_obligations_org_id_obligation_type_key" ON "org_compliance_obligations"("org_id", "obligation_type");

-- CreateIndex
CREATE INDEX "compliance_filings_org_id_due_date_idx" ON "compliance_filings"("org_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_filings_org_id_obligation_type_period_label_key" ON "compliance_filings"("org_id", "obligation_type", "period_label");

-- AddForeignKey
ALTER TABLE "org_compliance_obligations" ADD CONSTRAINT "org_compliance_obligations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_filings" ADD CONSTRAINT "compliance_filings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

