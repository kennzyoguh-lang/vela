-- Fixes a real gap from Foundation, caught by scripts/verify-rls.mjs while
-- building SmartInvoice: audit_log has an org_id column but never had RLS
-- enabled (Handbook 6.3 "no exceptions"). Without this, api_write_role's
-- SELECT grant on audit_log (rls-and-security.sql.template) had no
-- row-level filter at all — any authenticated org could, in principle, read
-- every other org's audit trail through the same query path. This is
-- orthogonal to and does not weaken the write-once guarantee already in
-- place (REVOKE UPDATE/DELETE + the immutability trigger stand as-is);
-- RLS only adds row visibility scoping on top.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON audit_log
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON audit_log
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
