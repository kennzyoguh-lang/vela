-- ComplianceRadar™ RLS — every org-scoped table, no exceptions (Handbook 6.3).
-- Same shape as SmartInvoice's migration: both tables are only ever written
-- from within an already-authenticated org context, so INSERT's WITH CHECK
-- requires org_id to match app.current_org_id, same as UPDATE/SELECT.
-- api_write_role already has blanket SELECT/INSERT/UPDATE/DELETE on ALL
-- TABLES IN SCHEMA public (Foundation's app_role_login migration), so no new
-- GRANT statements are needed here — only the policies themselves.

ALTER TABLE org_compliance_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON org_compliance_obligations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON org_compliance_obligations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON org_compliance_obligations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE compliance_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON compliance_filings
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON compliance_filings
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON compliance_filings
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
