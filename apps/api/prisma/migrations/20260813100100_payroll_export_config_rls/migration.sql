-- org_payroll_export_configs RLS (Handbook 6.3, every org-scoped table, no
-- exceptions) — same shape as org_payment_credentials/org_accounting_connections.
-- Disabling goes through UPDATE (is_active = false), never DELETE, same as
-- every other table in this codebase that has no delete policy.

ALTER TABLE org_payroll_export_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON org_payroll_export_configs
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON org_payroll_export_configs
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON org_payroll_export_configs
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
