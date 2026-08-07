CREATE TABLE "calculator_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "vat_penalty" DECIMAL(14, 2) NOT NULL,
    "wht_penalty" DECIMAL(14, 2) NOT NULL,
    "cit_penalty" DECIMAL(14, 2) NOT NULL,
    "total_penalty" DECIMAL(14, 2) NOT NULL,
    "converted_to_account" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "calculator_leads_pkey" PRIMARY KEY ("id")
);

-- calculator_leads has no org_id — anonymous marketing-site visitors have no
-- org yet, same "global ledger, no per-tenant scope" shape as webhook_events
-- (see 20260729010100_smartinvoice_rls's comment: "no policy is needed or
-- applicable here"). RLS is intentionally never enabled on this table.
