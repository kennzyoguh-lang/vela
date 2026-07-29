-- SmartInvoice™ RLS — every org-scoped table, no exceptions (Handbook 6.3).
-- Unlike organisations' INSERT policy (which must be unconditional since org
-- creation mints the tenant boundary itself), every table here is created
-- from WITHIN an already-authenticated org context — app.current_org_id is
-- already the user's real org before any of these inserts happen, so INSERT's
-- WITH CHECK can (and must) require org_id to match it, same as UPDATE/SELECT.
-- Grants: api_write_role already has blanket SELECT/INSERT/UPDATE/DELETE on
-- ALL TABLES IN SCHEMA public via Foundation's app_role_login migration, so no
-- new GRANT statements are needed here — only the policies themselves.

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON clients
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON clients
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON clients
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON invoices
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON invoices
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON invoices
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON recurring_invoices
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON recurring_invoices
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON recurring_invoices
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE transaction_markups ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON transaction_markups
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON transaction_markups
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE payment_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON payment_activations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON payment_activations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON payment_activations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE invoice_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON invoice_number_counters
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON invoice_number_counters
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON invoice_number_counters
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- webhook_events has no org_id (Handbook 6.3's RLS rule only applies to
-- org-scoped tables) — it's a global idempotency ledger the webhook handler
-- alone reads/writes, never queried per-tenant, so no policy is needed or
-- applicable here.
