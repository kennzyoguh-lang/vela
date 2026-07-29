-- PeopleHub RLS — every org-scoped table, no exceptions (Handbook 6.3). Same
-- shape as every prior phase's migration: all three tables are only ever
-- written from within an already-authenticated org context, so INSERT's
-- WITH CHECK requires org_id to match app.current_org_id, same as
-- UPDATE/SELECT. api_write_role already has blanket SELECT/INSERT/UPDATE/
-- DELETE on ALL TABLES IN SCHEMA public (Foundation's app_role_login
-- migration), so no new GRANT statements are needed — only the policies.

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON employees
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON employees
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON employees
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON payroll_runs
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON payroll_runs
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON payroll_runs
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON payslips
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON payslips
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON payslips
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
