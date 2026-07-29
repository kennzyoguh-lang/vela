-- The public payment portal (Design System 6.13, F-56) and payment webhooks
-- (Epic 5) both need to find an invoice's org_id with no pre-existing
-- authenticated org context — the same structural problem Foundation solved
-- for login-by-email (auth_lookup_user_by_email). Rather than one
-- SECURITY DEFINER function per field combination, this resolves ONLY the
-- org_id for a given payment_portal_token; every other read/write then goes
-- through the normal withOrgScope(orgId, ...) pattern once that's known,
-- keeping RLS enforcement structurally identical to every other code path.
CREATE OR REPLACE FUNCTION resolve_org_for_payment_token(p_token text)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT org_id FROM invoices WHERE payment_portal_token = p_token LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_org_for_payment_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_org_for_payment_token(text) TO api_write_role;
