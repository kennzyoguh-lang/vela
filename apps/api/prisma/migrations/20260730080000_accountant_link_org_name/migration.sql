-- N+1 fix: listMyLinks (accountant-portal.service.ts) previously called
-- list_accountant_links_for_user() then, per row, a separate
-- findOrganisationById to resolve the client org's name — 1 extra query per
-- linked org per page load. Since RLS is what forced the per-row lookup in
-- the first place (a single Postgres session can only have one
-- app.current_org_id set, so a normal withOrgScope batched read across
-- multiple different client orgs isn't possible), the function itself joins
-- organisations directly — the same SECURITY DEFINER escape hatch already
-- used for this exact cross-org read, now returning everything in one query
-- instead of requiring a second one at all.
-- Postgres won't let CREATE OR REPLACE change a function's RETURNS TABLE
-- shape (adding org_name is a row-type change) — has to be dropped first.
DROP FUNCTION IF EXISTS list_accountant_links_for_user(uuid, citext);

CREATE FUNCTION list_accountant_links_for_user(p_user_id uuid, p_email citext)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  org_name text,
  status text,
  invited_at timestamptz,
  responded_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT l.id, l.org_id, o.name, l.status::text, l.invited_at, l.responded_at
  FROM accountant_client_links l
  JOIN organisations o ON o.id = l.org_id
  WHERE l.accountant_user_id = p_user_id
     OR (l.accountant_user_id IS NULL AND l.accountant_email = p_email);
$$;

GRANT EXECUTE ON FUNCTION list_accountant_links_for_user(uuid, citext) TO api_write_role;
