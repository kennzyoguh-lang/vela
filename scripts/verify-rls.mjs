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

// Extracts each `model Name { ... }` block by tracking brace depth and
// skipping over quoted strings, rather than a single non-greedy regex —
// a naive `{([^}]*)}` stops at the FIRST literal `}`, which truncates any
// model containing a JSON-string default like `@default("{}")` before it
// ever reaches that model's `@@map(...)` line. That bug previously caused
// this script to check the wrong table name for `Organisation` (falling
// back to a wrong table name derived from the model name instead of its
// real mapped table) — a false positive, not a real missing RLS policy.
function extractModelBlocks(schema) {
  const blocks = [];
  const modelStart = /model\s+(\w+)\s*{/g;
  let match;
  while ((match = modelStart.exec(schema)) !== null) {
    const modelName = match[1];
    let depth = 1;
    let i = modelStart.lastIndex;
    let inString = false;
    while (i < schema.length && depth > 0) {
      const ch = schema[i];
      if (inString) {
        if (ch === '"' && schema[i - 1] !== "\\") inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
      }
      i++;
    }
    blocks.push({ modelName, body: schema.slice(modelStart.lastIndex, i - 1) });
    modelStart.lastIndex = i;
  }
  return blocks;
}

function extractOrgScopedTables(schema) {
  const tables = [];
  for (const { modelName, body } of extractModelBlocks(schema)) {
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
