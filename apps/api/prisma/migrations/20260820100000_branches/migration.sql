-- Multi-branch — a physical location tag, deliberately narrow in scope.
-- See schema.prisma's comment on the Branch model for why invoicing,
-- payroll, compliance, and every connector stay org-wide instead of
-- being split by branch.

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_org_id_name_key" ON "branches"("org_id", "name");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: tag the transactional/staff data that actually varies by
-- location. Nullable everywhere so a single-branch org never has to tag
-- anything.
ALTER TABLE "users" ADD COLUMN "branch_id" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales" ADD COLUMN "branch_id" UUID;
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_reconciliations" ADD COLUMN "branch_id" UUID;
ALTER TABLE "cash_reconciliations" ADD CONSTRAINT "cash_reconciliations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
