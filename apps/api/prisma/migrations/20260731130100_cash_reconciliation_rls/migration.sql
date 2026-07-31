-- Anti-theft Piece 2 RLS — same standard org_isolation_* shape as every
-- prior phase (Handbook 6.3). api_write_role already has blanket
-- SELECT/INSERT/UPDATE/DELETE on ALL TABLES IN SCHEMA public, so no new
-- GRANT statements are needed — only the policies.
ALTER TABLE cash_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON cash_reconciliations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON cash_reconciliations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON cash_reconciliations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
