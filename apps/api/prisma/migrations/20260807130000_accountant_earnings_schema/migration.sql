CREATE TABLE "accountant_earnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "referred_count" INTEGER NOT NULL,
    "active_client_count" INTEGER NOT NULL,
    "amount_owed" DECIMAL(14, 2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "accountant_earnings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accountant_earnings_org_id_month_key" ON "accountant_earnings"("org_id", "month");

ALTER TABLE "accountant_earnings"
  ADD CONSTRAINT "accountant_earnings_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE;

-- Org-scoped from the accountant firm's own perspective — standard
-- 3-policy RLS template (Handbook 6.3), same shape as every other
-- org-scoped table. UPDATE is included (unlike referral_codes/
-- referral_conversions) because the monthly job upserts the same
-- (org_id, month) row if it ever re-runs for a month already generated.
ALTER TABLE accountant_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON accountant_earnings
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON accountant_earnings
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON accountant_earnings
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Background job enumeration (Handbook 5.8), same "ids only" shape as
-- list_all_org_ids (migration 20260729010400) — an "accountant org" is any
-- organisation with at least one user whose role is 'accountant'.
CREATE OR REPLACE FUNCTION list_accountant_org_ids()
RETURNS TABLE (id uuid)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT org_id AS id FROM users WHERE role = 'accountant';
$$;

REVOKE ALL ON FUNCTION list_accountant_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_accountant_org_ids() TO api_write_role;

-- The monthly earnings job's two inputs, computed server-side in one
-- narrow SECURITY DEFINER read rather than exposing raw referral_conversions
-- or accountant_client_links rows across org boundaries. referred_count
-- reuses referral_conversions the same way any org's own referral activity
-- would (an accounting firm's org can hold a referral code like any other);
-- active_client_count comes from the unrelated, pre-existing
-- accountant_client_links relationship (an accountant's actual client
-- roster), joined here because both counts are needed together for one
-- accountant_earnings row.
CREATE OR REPLACE FUNCTION accountant_earnings_inputs(
  p_org_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
RETURNS TABLE (referred_count bigint, active_client_count bigint)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT count(*) FROM referral_conversions
       WHERE org_id = p_org_id AND converted_at >= p_month_start AND converted_at < p_month_end),
    (SELECT count(*) FROM accountant_client_links acl
       JOIN users u ON u.id = acl.accountant_user_id
       WHERE u.org_id = p_org_id AND acl.status = 'active');
$$;

REVOKE ALL ON FUNCTION accountant_earnings_inputs(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accountant_earnings_inputs(uuid, timestamptz, timestamptz) TO api_write_role;
