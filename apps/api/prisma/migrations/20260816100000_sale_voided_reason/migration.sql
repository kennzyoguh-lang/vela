-- Voiding a sale (sale.service.ts#voidSale) — the SaleStatus enum already
-- had "voided" as a value, but no code path ever actually set it. Mirrors
-- Invoice.voidedReason exactly.

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "voided_reason" TEXT;
