-- org_payment_credentials RLS (Handbook 6.3, every org-scoped table, no
-- exceptions) — same shape as every other org-isolated table. Deactivation
-- goes through UPDATE (is_active = false), never DELETE, same as every
-- other table in this codebase that has no delete policy — api_write_role
-- already has no blanket DELETE grant beyond what each table's own policy
-- allows.

ALTER TABLE org_payment_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON org_payment_credentials
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON org_payment_credentials
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON org_payment_credentials
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
