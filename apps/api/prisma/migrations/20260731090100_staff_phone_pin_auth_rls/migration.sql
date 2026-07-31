-- Phone+PIN login has no single org context to scope by (same structural
-- problem as auth_lookup_user_by_email for email+password login) — this
-- narrow SECURITY DEFINER function is the equivalent lookup for phone. No
-- new RLS policy needed on `users` — its existing org_isolation_* policies
-- are untouched; this is the same "one narrow SECURITY DEFINER exception"
-- pattern already established for email.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_phone(p_phone citext)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  pin_hash text,
  pin_device_id text,
  role text,
  is_active boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT id, org_id, pin_hash, pin_device_id, role::text, is_active
  FROM users
  WHERE phone = p_phone
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_phone(citext) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_phone(citext) TO api_write_role;
