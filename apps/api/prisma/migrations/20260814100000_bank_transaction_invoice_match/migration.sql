-- Bank reconciliation — matches an incoming bank transaction to the invoice
-- it settled, for a customer who paid by direct bank transfer instead of
-- through Vela's own payment portal (schema.prisma's comment on
-- BankTransaction.matchedInvoiceId explains why this never marks the
-- invoice paid by itself).

-- AlterTable
ALTER TABLE "bank_transactions" ADD COLUMN "matched_invoice_id" UUID;
ALTER TABLE "bank_transactions" ADD COLUMN "matched_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "bank_transactions_matched_invoice_id_idx" ON "bank_transactions"("matched_invoice_id");

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_invoice_id_fkey" FOREIGN KEY ("matched_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
