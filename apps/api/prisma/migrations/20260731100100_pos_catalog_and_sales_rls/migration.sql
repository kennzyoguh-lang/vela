-- POS catalog & sales RLS — every org-scoped table, no exceptions (Handbook
-- 6.3), same shape as every prior phase's migration. api_write_role already
-- has blanket SELECT/INSERT/UPDATE/DELETE on ALL TABLES IN SCHEMA public
-- (Foundation's app_role_login migration), so no new GRANT statements are
-- needed here — only the policies.

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON products
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON products
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON products
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON sales
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON sales
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON sales
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON sale_items
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON sale_items
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON sale_items
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
