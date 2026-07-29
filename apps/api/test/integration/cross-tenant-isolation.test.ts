// The single highest-priority test in Epic 6 (Handbook 14.3): two orgs, data in
// both, and org A must never be able to see org B's rows through any query
// path — including a repository bug that forgets `WHERE org_id = ?`, because
// Postgres RLS itself refuses the row (prisma/rls-and-security.sql.template).
//
// PREREQUISITE: the RLS migration must be applied to the test database before
// this test is meaningful (see rls-and-security.sql.template's header for the
// exact `prisma migrate dev --create-only` steps). Until then this test will
// fail — that failure is correct and expected, not a false positive to silence.
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { prisma, withOrgScope } from "../../src/lib/prisma";

// Test-local helper mirroring organisation.repository.ts#createOrganisation:
// INSERT ... RETURNING (what Prisma's .create() always does) also has to
// satisfy the SELECT policy for the row being returned, so the org's id is
// pre-generated and app.current_org_id is set to that same id before the
// insert — never created via the unscoped client (see the template's note).
function createTestOrg(name: string) {
  const id = randomUUID();
  return withOrgScope(id, (tx) => tx.organisation.create({ data: { id, name, country: "NG" } }));
}

describe("cross-tenant isolation (RLS)", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it("never returns org B's organisation row while scoped to org A", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const result = await withOrgScope(orgA.id, (tx) =>
      tx.organisation.findUnique({ where: { id: orgB.id } }),
    );

    expect(result).toBeNull();
  });

  it("never returns org B's users while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.user.create({
        data: {
          orgId: orgB.id,
          name: "Org B Owner",
          email: `org-b-owner-${orgB.id}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "owner",
        },
      }),
    );

    // Intentionally omits `where: { orgId }` — this is the exact bug class RLS
    // exists to make structurally impossible, not merely a lint rule.
    const rows = await withOrgScope(orgA.id, (tx) => tx.user.findMany({}));

    expect(rows.every((u) => u.orgId === orgA.id)).toBe(true);
    expect(rows.some((u) => u.orgId === orgB.id)).toBe(false);
  });

  it("the Accountant cross-org read exception still denies unlinked orgs", async () => {
    // Foundation ships no accountant_client_links table yet (that's Accountant
    // Portal, a later phase) — this test is a placeholder asserting the base
    // isolation policy holds with no accountant exception carved out yet, so a
    // future migration adding that exception has a regression baseline to diff
    // against (Handbook 6.3's "never by disabling the base policy" rule).
    const orgA = await createTestOrg("Org A");
    createdOrgIds.push(orgA.id);
    const rows = await withOrgScope(orgA.id, (tx) => tx.organisation.findMany({}));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(orgA.id);
  });

  // SmartInvoice (Phase 2) introduced clients/invoices as new org-scoped
  // tables — same isolation guarantee, extended rather than assumed to carry
  // over automatically (each table's RLS policy is a separate migration).
  it("never returns org B's clients while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId: orgB.id, name: "Org B Client", paymentTerms: 14 },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.client.findMany({}));

    expect(rows.every((c) => c.orgId === orgA.id)).toBe(true);
    expect(rows.some((c) => c.orgId === orgB.id)).toBe(false);
  });

  it("never returns org B's invoices while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const clientB = await withOrgScope(orgB.id, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId: orgB.id, name: "Org B Client", paymentTerms: 14 },
      }),
    );
    await withOrgScope(orgB.id, (tx) =>
      tx.invoice.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          number: "INV-0001",
          clientId: clientB.id,
          lineItems: [{ description: "Org B work", quantity: 1, unitPrice: 1000 }],
          subtotal: 1000,
          tax: 0,
          discount: 0,
          total: 1000,
          currency: "NGN",
          dueDate: new Date("2026-08-01"),
          paymentPortalToken: randomUUID(),
        },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.invoice.findMany({}));

    expect(rows.every((i) => i.orgId === orgA.id)).toBe(true);
    expect(rows.some((i) => i.orgId === orgB.id)).toBe(false);
  });

  it("org A cannot mutate org B's invoice by guessing its id", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const clientB = await withOrgScope(orgB.id, (tx) =>
      tx.client.create({
        data: { id: randomUUID(), orgId: orgB.id, name: "Org B Client", paymentTerms: 14 },
      }),
    );
    const invoiceB = await withOrgScope(orgB.id, (tx) =>
      tx.invoice.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          number: "INV-0001",
          clientId: clientB.id,
          lineItems: [{ description: "Org B work", quantity: 1, unitPrice: 1000 }],
          subtotal: 1000,
          tax: 0,
          discount: 0,
          total: 1000,
          currency: "NGN",
          dueDate: new Date("2026-08-01"),
          paymentPortalToken: randomUUID(),
        },
      }),
    );

    // Prisma's .update({where:{id, orgId}}) throws (record not found under
    // org A's RLS view) rather than silently affecting 0 rows elsewhere —
    // this is what every repository's updateStatus-style call relies on.
    await expect(
      withOrgScope(orgA.id, (tx) =>
        tx.invoice.update({ where: { id: invoiceB.id, orgId: orgA.id }, data: { status: "paid" } }),
      ),
    ).rejects.toThrow();

    const stillUnpaid = await withOrgScope(orgB.id, (tx) =>
      tx.invoice.findUnique({ where: { id: invoiceB.id } }),
    );
    expect(stillUnpaid?.status).toBe("draft");
  });
});
