ALTER TABLE "organisations"
  ADD COLUMN "referred_by_org_id" UUID,
  ADD COLUMN "referred_by_code_id" UUID;

CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE;

CREATE TABLE "referral_conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "referee_org_id" UUID NOT NULL,
    "referral_code_id" UUID NOT NULL,
    "conversion_event" TEXT NOT NULL,
    "converted_at" TIMESTAMPTZ NOT NULL,
    "reward_recorded_at" TIMESTAMPTZ NOT NULL,
    "reward_description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "referral_conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_conversions_referee_org_id_key" ON "referral_conversions"("referee_org_id");

ALTER TABLE "referral_conversions"
  ADD CONSTRAINT "referral_conversions_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE;

-- Both org-scoped from the REFERRER's perspective (org_id = the org that
-- owns the code / earns the reward) — standard 3-policy RLS template,
-- same shape as every other org-scoped table (Handbook 6.3).
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON referral_codes
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON referral_codes
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON referral_conversions
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON referral_conversions
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Resolving a referral code has no org context to scope by — the same
-- structural problem as resolve_org_for_payment_token (migration
-- 20260729010300) and list_accountant_links_for_user (20260729050100).
-- Used both by the public /refer/[code] landing page (validate a code
-- exists, nothing more) and by signup (auth.service.ts#signup, before any
-- org context exists at all) to resolve the code into the two ids stored
-- on the new Organisation row.
CREATE OR REPLACE FUNCTION resolve_referral_code(p_code text)
RETURNS TABLE (
  org_id uuid,
  code_id uuid
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT org_id, id FROM referral_codes WHERE code = p_code;
$$;

REVOKE ALL ON FUNCTION resolve_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_referral_code(text) TO api_write_role;
