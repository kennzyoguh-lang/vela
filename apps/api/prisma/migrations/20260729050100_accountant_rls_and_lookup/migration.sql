-- Accountant Portal RLS + cross-org link lookup (Phase 6).
--
-- RLS: accountant_client_links is org-scoped from the CLIENT org's
-- perspective (org_id = the granting org) — a client org manages its own
-- outgoing links exactly like organisation_invites, no special-casing.
ALTER TABLE accountant_client_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation_select ON accountant_client_links
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON accountant_client_links
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON accountant_client_links
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- An accountant reading "which client orgs am I linked to" has no single
-- org context to scope by — the same structural problem as login-by-email
-- (auth_lookup_user_by_email), the public payment portal
-- (resolve_org_for_payment_token), and background-job org enumeration
-- (list_all_org_ids). Rather than opening accountant_client_links's table
-- policy, this narrow SECURITY DEFINER function returns only the rows
-- belonging to this specific user (already-accepted links) or addressed to
-- their email (pending invites not yet accepted) — every other read/write
-- goes through the normal withOrgScope(clientOrgId, ...) path once a
-- specific link has been resolved (accountant-portal.service.ts).
CREATE OR REPLACE FUNCTION list_accountant_links_for_user(p_user_id uuid, p_email citext)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  status text,
  invited_at timestamptz,
  responded_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT id, org_id, status::text, invited_at, responded_at
  FROM accountant_client_links
  WHERE accountant_user_id = p_user_id
     OR (accountant_user_id IS NULL AND accountant_email = p_email);
$$;

REVOKE ALL ON FUNCTION list_accountant_links_for_user(uuid, citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_accountant_links_for_user(uuid, citext) TO api_write_role;
