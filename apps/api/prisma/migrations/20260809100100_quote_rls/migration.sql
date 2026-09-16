-- Quotes RLS (Handbook 6.3, every org-scoped table, no exceptions) — same
-- shape as smartinvoice_rls. api_write_role already has blanket
-- SELECT/INSERT/UPDATE/DELETE on ALL TABLES IN SCHEMA public via
-- Foundation's app_role_login migration, so only the policies are needed
-- here, no new GRANTs.

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON quotes
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON quotes
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON quotes
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE quote_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON quote_number_counters
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON quote_number_counters
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON quote_number_counters
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Public quote portal (mirrors resolve_org_for_payment_token exactly, same
-- reasoning: the client viewing/responding to a quote has no authenticated
-- org context at all, so this resolves ONLY the org_id for a given
-- portal_token; every actual read/write then goes through the normal
-- withOrgScope(orgId, ...) path once that's known).
CREATE OR REPLACE FUNCTION resolve_org_for_quote_token(p_token text)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT org_id FROM quotes WHERE portal_token = p_token LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_org_for_quote_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_org_for_quote_token(text) TO api_write_role;
