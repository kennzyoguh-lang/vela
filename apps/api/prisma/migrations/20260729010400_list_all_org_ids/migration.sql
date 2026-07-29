-- Background jobs (Handbook 5.8 — reminders, recurring invoices, and later
-- compliance alerts / cash-flow scans) are system-level work that genuinely
-- needs to enumerate every organisation, not one tenant's request. RLS
-- correctly denies a plain SELECT across organisations (Handbook 6.3 — no
-- exceptions), so this is the narrow, documented SECURITY DEFINER exception
-- for that one legitimate case, following the exact same pattern as
-- auth_lookup_user_by_email and resolve_org_for_payment_token: it returns
-- ONLY ids, never any organisation's actual data, and every job that calls it
-- still uses withOrgScope(orgId, ...) for the real per-org data access —
-- this function only ever answers "which orgs exist", nothing else.
CREATE OR REPLACE FUNCTION list_all_org_ids()
RETURNS TABLE (id uuid)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM organisations;
$$;

REVOKE ALL ON FUNCTION list_all_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_all_org_ids() TO api_write_role;
