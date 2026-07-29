-- CreateEnum
CREATE TYPE "bank_sync_provider" AS ENUM ('mono', 'okra');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "transaction_category" AS ENUM ('income', 'cost_of_goods', 'payroll', 'rent', 'utilities', 'marketing', 'transport', 'other_expense', 'transfer', 'uncategorized');

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "provider" "bank_sync_provider" NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "institution_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "account_number_masked" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "provider_transaction_id" TEXT NOT NULL,
    "type" "transaction_type" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" "transaction_category" NOT NULL DEFAULT 'uncategorized',
    "categorized_manually" BOOLEAN NOT NULL DEFAULT false,
    "narration" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_org_id_provider_provider_account_id_key" ON "bank_accounts"("org_id", "provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "bank_transactions_org_id_transaction_date_idx" ON "bank_transactions"("org_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_bank_account_id_provider_transaction_id_key" ON "bank_transactions"("bank_account_id", "provider_transaction_id");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

