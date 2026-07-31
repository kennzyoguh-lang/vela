-- Anti-theft Piece 4: staff-proof discount approval guardrail.
-- AlterTable
ALTER TABLE "organisations" ADD COLUMN "discount_approval_pin_hash" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
