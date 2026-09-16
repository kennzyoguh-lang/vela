-- Extensions must exist before any migration can use the types/functions
-- they provide. 20260728230004_init uses the CITEXT type (for case-
-- insensitive email columns) without creating the citext extension first —
-- on a truly fresh Postgres (a new CI run, a new developer's machine),
-- `prisma migrate deploy` fails at that very first migration with
-- `type "citext" does not exist". This has only ever gone unnoticed because
-- the one long-lived database this project has actually migrated (the live
-- Supabase project) already had citext enabled out-of-band before these
-- migrations first ran against it.
--
-- Named to sort immediately before 20260728230004_init so it runs first on
-- a fresh database. Both statements are also present (harmlessly,
-- idempotently) in 20260728231500_rls_and_security — IF NOT EXISTS makes
-- re-running them there a no-op once this migration has already applied,
-- and a no-op here against the already-migrated production database, where
-- both extensions already exist.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
