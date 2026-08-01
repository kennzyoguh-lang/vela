-- Business profiling (onboarding factor capture) — three independent
-- factors per org, each with a genuine "unsure" state, driving per-module
-- default visibility computed in packages/types/src/business-profile.ts.
-- Never a single formality tier column.
CREATE TYPE "customer_pattern" AS ENUM ('one_time', 'repeat', 'unsure');
CREATE TYPE "yes_no_unsure" AS ENUM ('yes', 'no', 'unsure');

ALTER TABLE "organisations"
  ADD COLUMN "customer_pattern" "customer_pattern" NOT NULL DEFAULT 'unsure',
  ADD COLUMN "has_sales_staff" "yes_no_unsure" NOT NULL DEFAULT 'unsure',
  ADD COLUMN "is_cac_registered" "yes_no_unsure" NOT NULL DEFAULT 'unsure',
  ADD COLUMN "module_overrides" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "profile_factors_confirmed_at" TIMESTAMPTZ;
