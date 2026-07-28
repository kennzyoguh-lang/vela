#!/usr/bin/env node
// CI gate — Engineering Handbook Part 5.4/8.4: no raw, unparameterized SQL
// string interpolation anywhere except the one documented, UUID-validated
// exception in apps/api/src/lib/prisma.ts (`withOrgScope`'s `SET LOCAL`, which
// Postgres doesn't allow to be a bound parameter).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const apiSrc = join(import.meta.dirname, "..", "apps", "api", "src");
const ALLOWED_FILE = join(apiSrc, "lib", "prisma.ts");
const UNSAFE_PATTERN = /\$executeRawUnsafe|\$queryRawUnsafe/;

function listTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const offenders = [];
for (const file of listTsFiles(apiSrc)) {
  if (file === ALLOWED_FILE) continue;
  const content = readFileSync(file, "utf8");
  if (UNSAFE_PATTERN.test(content)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error("SQL lint FAILED — raw/unsafe SQL found outside the one documented exception:");
  for (const f of offenders) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("SQL lint passed — no raw SQL string interpolation outside lib/prisma.ts");
