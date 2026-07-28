-- Grants for api_write_role, the non-owner, non-superuser role the app
-- connects as at runtime (Handbook 6.3: RLS is never enforced against a
-- table's owner or a superuser, so the connecting role matters structurally,
-- not cosmetically). The role's actual LOGIN password is set out-of-band via
-- `prisma db execute` immediately after this migration, never committed here
-- (Handbook 8.6 — no secret ever in source control, migration files included).

GRANT USAGE ON SCHEMA public TO api_write_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_write_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO api_write_role;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(citext) TO api_write_role;

-- Re-affirm write-once now that this role can actually connect and query —
-- the audit_log-specific revoke from the earlier migration still holds, this
-- just makes the intent explicit again in the same migration that makes the
-- role connectable.
REVOKE UPDATE, DELETE ON audit_log FROM api_write_role;
