-- Ask Vela RLS (Phase 7).
--
-- Both tables are org-scoped exactly like every other feature table — no
-- SECURITY DEFINER function is needed here, unlike Accountant Portal or the
-- payment portal, because every Ask Vela read/write already has an org
-- context from the authenticated request (there is no "no org context yet"
-- case to solve — the assistant only ever answers within the caller's own
-- org, never across orgs).
ALTER TABLE ask_vela_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON ask_vela_conversations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON ask_vela_conversations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON ask_vela_conversations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

ALTER TABLE ask_vela_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON ask_vela_messages
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON ask_vela_messages
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON ask_vela_messages
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
