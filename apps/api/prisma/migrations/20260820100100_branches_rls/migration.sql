-- branches RLS (Handbook 6.3, every org-scoped table, no exceptions).
-- UPDATE is needed here — renaming/deactivating a branch updates its own
-- row rather than creating a new one. No DELETE policy: branches are
-- deactivated (is_active = false), never removed, since Sale/User/
-- CashReconciliation rows may still reference one historically.

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON branches
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON branches
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON branches
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
