CREATE TABLE "waitlist_signups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "revenue_range" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id")
);

-- waitlist_signups has no org_id — anonymous marketing-site visitors have no
-- org yet, same "global ledger, no per-tenant scope" shape as
-- calculator_leads / webhook_events. RLS is intentionally never enabled on
-- this table.
