-- expense_claims RLS (Handbook 6.3, every org-scoped table, no exceptions).
-- UPDATE is needed here (unlike stored_files) — approving/rejecting a
-- claim updates its own row rather than creating a new one.

ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON expense_claims
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON expense_claims
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON expense_claims
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
