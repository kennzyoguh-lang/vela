-- SmartInvoice™ (Phase 2, BRD Module 1 / Handbook Part 16.1) schema.
-- Generated via `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...`
-- against the live database (non-interactive workaround, same as Foundation's
-- init migration — see prisma/rls-and-security.sql.template's header).

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'written_off', 'void');

-- CreateEnum
CREATE TYPE "recurring_frequency" AS ENUM ('weekly', 'monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "payment_processor" AS ENUM ('paystack', 'flutterwave', 'stripe');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "payment_terms" INTEGER NOT NULL DEFAULT 14,
    "avg_payment_days" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_number_counters" (
    "org_id" UUID NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_number_counters_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "invoices" (
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
    "status" "invoice_status" NOT NULL DEFAULT 'draft',
    "due_date" DATE NOT NULL,
    "risk_score" INTEGER,
    "payment_portal_token" TEXT NOT NULL,
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ,
    "viewed_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "voided_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "frequency" "recurring_frequency" NOT NULL,
    "next_send_date" DATE NOT NULL,
    "template_data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_markups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "processor" "payment_processor" NOT NULL,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "processor_fee" DECIMAL(14,2) NOT NULL,
    "vela_markup_pct" DECIMAL(5,4) NOT NULL,
    "vela_fee_amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "settled_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_markups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_activations" (
    "org_id" UUID NOT NULL,
    "pay_now_enabled_at" TIMESTAMPTZ,
    "first_payment_received_at" TIMESTAMPTZ,
    "activation_channel" TEXT,
    "cumulative_volume_ngn" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_activations_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "processor" "payment_processor" NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_org_id_idx" ON "clients"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_portal_token_key" ON "invoices"("payment_portal_token");

-- CreateIndex
CREATE INDEX "invoices_org_id_status_due_date_idx" ON "invoices"("org_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_org_id_number_key" ON "invoices"("org_id", "number");

-- CreateIndex
CREATE INDEX "recurring_invoices_org_id_status_next_send_date_idx" ON "recurring_invoices"("org_id", "status", "next_send_date");

-- CreateIndex
CREATE INDEX "transaction_markups_org_id_settled_at_idx" ON "transaction_markups"("org_id", "settled_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_processor_provider_event_id_key" ON "webhook_events"("processor", "provider_event_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_markups" ADD CONSTRAINT "transaction_markups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_markups" ADD CONSTRAINT "transaction_markups_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_activations" ADD CONSTRAINT "payment_activations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

