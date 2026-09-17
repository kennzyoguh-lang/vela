-- org_accounting_connections / invoice_accounting_syncs RLS (Handbook 6.3,
-- every org-scoped table, no exceptions) — same shape as org_payment_credentials.
-- Disconnecting an accounting connection goes through UPDATE (is_active =
-- false), never DELETE, same as every other table in this codebase that has
-- no delete policy.

ALTER TABLE org_accounting_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON org_accounting_connections
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON org_accounting_connections
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON org_accounting_connections
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE invoice_accounting_syncs ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON invoice_accounting_syncs
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON invoice_accounting_syncs
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Same cross-org-read shape as list_all_org_ids/list_accountant_org_ids —
-- the daily accounting-push job (accounting-push.job.ts) needs to find
-- every org with an active connection before it can iterate them one at a
-- time through the normal withOrgScope(orgId, ...) path (which is what
-- actually reads each connection's encrypted tokens). Returns only org_id
-- and provider, never the token columns, so this function can't become a
-- second way to read the secrets those RLS policies exist to protect.
CREATE OR REPLACE FUNCTION list_active_accounting_connections()
RETURNS TABLE (org_id uuid, provider accounting_provider)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT org_id, provider FROM org_accounting_connections WHERE is_active = true;
$$;

REVOKE ALL ON FUNCTION list_active_accounting_connections() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_active_accounting_connections() TO api_write_role;
