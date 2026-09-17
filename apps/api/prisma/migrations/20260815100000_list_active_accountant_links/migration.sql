-- Same cross-org-read shape as list_all_org_ids/list_accountant_org_ids —
-- the monthly automated-accountant-report job (accountant-report.job.ts)
-- needs to find every active accountant<->client link across every org
-- before it can iterate them one at a time through the normal
-- withOrgScope(orgId, ...) path (which is what actually reads that org's
-- own financial data). Returns only what's needed to address the email and
-- open the right org's data — never anything from the client org itself.
CREATE OR REPLACE FUNCTION list_active_accountant_links()
RETURNS TABLE (org_id uuid, accountant_email citext)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT org_id, accountant_email FROM accountant_client_links WHERE status = 'active';
$$;

REVOKE ALL ON FUNCTION list_active_accountant_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_active_accountant_links() TO api_write_role;
