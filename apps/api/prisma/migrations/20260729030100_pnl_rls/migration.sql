-- P&L Intelligence RLS — every org-scoped table, no exceptions (Handbook 6.3).
-- Same shape as SmartInvoice's and ComplianceRadar's migrations: both tables
-- are only ever written from within an already-authenticated org context, so
-- INSERT's WITH CHECK requires org_id to match app.current_org_id, same as
-- UPDATE/SELECT. api_write_role already has blanket SELECT/INSERT/UPDATE/
-- DELETE on ALL TABLES IN SCHEMA public (Foundation's app_role_login
-- migration), so no new GRANT statements are needed — only the policies.

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON bank_accounts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON bank_accounts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON bank_accounts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON bank_transactions
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON bank_transactions
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON bank_transactions
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
