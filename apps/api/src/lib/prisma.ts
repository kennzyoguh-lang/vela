import { PrismaClient } from "@prisma/client";

// The running app connects via APP_DATABASE_URL — a plain, non-owner,
// non-superuser role (api_write_role) — never the DATABASE_URL used by
// `prisma migrate`. Postgres never enforces RLS against a table's owner or a
// superuser, regardless of how many policies exist, so using the migration
// role here would silently defeat every RLS policy in the database (this was
// a real bug caught during Foundation verification, not a hypothetical).
export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.APP_DATABASE_URL } },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withOrgScope<T>(
  orgId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  // Postgres `SET LOCAL` cannot take a bound parameter, so orgId is interpolated
  // directly — this is the one place in the codebase that does that. The UUID
  // format check below is a strict allow-list validation (Handbook 8.4's
  // parameterized-queries-only rule extended to the one case where a literal
  // bound parameter isn't possible), not an optional sanity check.
  if (!UUID_RE.test(orgId)) {
    throw new Error(`withOrgScope received a non-UUID orgId: ${JSON.stringify(orgId)}`);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgId}'`);
    return fn(tx as unknown as PrismaClient);
  });
}
