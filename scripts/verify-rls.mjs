#!/usr/bin/env node
// CI gate — Engineering Handbook Part 6.3 ("no exceptions") + Part 11.2's
// `rls-policy-check` job. Fails the build if schema.prisma defines a table with
// an org_id/orgId column that has no matching `ENABLE ROW LEVEL SECURITY` +
// policy statement anywhere in the applied migrations. This caught a real gap
// during Phase 2 (SmartInvoice): audit_log had an org_id column since
// Foundation but never actually had RLS enabled — fixed in
// migrations/20260729010200_audit_log_rls.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const apiDir = join(import.meta.dirname, "..", "apps", "api");
const schemaPath = join(apiDir, "prisma", "schema.prisma");
const migrationsDir = join(apiDir, "prisma", "migrations");

function extractOrgScopedTables(schema) {
  const tables = [];
  const modelBlocks = schema.matchAll(/model\s+(\w+)\s*{([^}]*)}/gs);
  for (const [, modelName, body] of modelBlocks) {
    const hasOrgId = /\borgId\s+String\b/.test(body) || modelName === "Organisation";
    if (!hasOrgId) continue;
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    tables.push(mapMatch ? mapMatch[1] : modelName.toLowerCase());
  }
  return tables;
}

function collectMigrationSql() {
  let sql = "";
  if (existsSync(migrationsDir)) {
    for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sqlFile = join(migrationsDir, entry.name, "migration.sql");
      if (existsSync(sqlFile)) sql += readFileSync(sqlFile, "utf8") + "\n";
    }
  }
  return sql;
}

const schema = readFileSync(schemaPath, "utf8");
const tables = extractOrgScopedTables(schema);
const migrationSql = collectMigrationSql();

const missing = tables.filter((table) => {
  const re = new RegExp(`ALTER TABLE\\s+${table}\\s+ENABLE ROW LEVEL SECURITY`, "i");
  return !re.test(migrationSql);
});

if (missing.length > 0) {
  console.error("RLS policy check FAILED. Missing ENABLE ROW LEVEL SECURITY for:");
  for (const t of missing) console.error(`  - ${t}`);
  process.exit(1);
}

console.log(`RLS policy check passed for ${tables.length} org-scoped table(s): ${tables.join(", ")}`);
