#!/usr/bin/env node
// Bootstraps api_write_role's LOGIN password on a fresh database.
//
// The RLS migration (20260728231500_rls_and_security) creates api_write_role
// as NOLOGIN — deliberately, since a real password can never live in a
// migration file (Handbook 8.6). Foundation's app_role_login migration then
// grants that role its table privileges, but the actual
// `ALTER ROLE api_write_role WITH LOGIN PASSWORD ...` step was, until now,
// only ever run by hand against the live Supabase project — meaning no
// fresh environment (a new developer's machine, or CI's ephemeral Postgres
// service) could ever actually reach a working database from `prisma
// migrate deploy` alone; connecting as APP_DATABASE_URL would fail with
// "role api_write_role cannot log in" every time. This script makes that
// step scripted and idempotent instead of tribal knowledge, so the actual
// password value is supplied by the environment, never committed anywhere.
//
// Run after `prisma migrate deploy`, connected as the migration-owner role
// (DATABASE_URL) — see the "db:setup" script in package.json.
//
// ALTER ROLE is a utility statement, not a regular DML query — Postgres
// does not reliably support bound ($1-style) parameters inside it via every
// driver/protocol path, so the password is embedded as a standard-quoted
// SQL string literal instead, with the one escape that matters (doubling
// embedded single quotes, the standard Postgres literal-escaping rule).
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const password = process.env.API_WRITE_ROLE_PASSWORD;

if (!databaseUrl) {
  console.error("setup-role: DATABASE_URL is required (owner connection, not APP_DATABASE_URL).");
  process.exit(1);
}
if (!password) {
  console.error("setup-role: API_WRITE_ROLE_PASSWORD is required.");
  process.exit(1);
}

function quoteLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  await prisma.$executeRawUnsafe(
    `ALTER ROLE api_write_role WITH LOGIN PASSWORD ${quoteLiteral(password)}`,
  );
  console.log("setup-role: api_write_role LOGIN password set.");
} finally {
  await prisma.$disconnect();
}
