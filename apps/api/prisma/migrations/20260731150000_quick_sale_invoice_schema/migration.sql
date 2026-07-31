-- Quick Sale / Instant Collect Piece 1: reuse Invoice as the underlying
-- record for an amount-only walk-in payment (see schema.prisma's
-- InvoiceSource comment for why this isn't a separate model).

-- CreateEnum
CREATE TYPE "invoice_source" AS ENUM ('manual', 'quick_sale');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "source" "invoice_source" NOT NULL DEFAULT 'manual';
ALTER TABLE "invoices" ALTER COLUMN "client_id" DROP NOT NULL;
