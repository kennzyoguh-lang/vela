-- organisation_kyc RLS (Handbook 6.3, every org-scoped table, no
-- exceptions) — same shape as org_payroll_export_configs.

ALTER TABLE organisation_kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON organisation_kyc
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON organisation_kyc
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON organisation_kyc
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
