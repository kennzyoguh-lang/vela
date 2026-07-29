// The single most important test in Phase 7 — proves a prompt injection or
// model mistake asking for "all invoices" (or any other tool) can never leak
// cross-org data, because every tool executor is bound to the request's own
// JWT-derived orgId, not anything the model can influence. Structurally
// analogous to why cross-tenant-isolation.test.ts calls its own RLS test
// suite the highest-priority test in this codebase.
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { prisma, withOrgScope } from "../../src/lib/prisma";
import { getToolByName } from "../../src/services/ask-vela/tools";

function createTestOrg(name: string) {
  const id = randomUUID();
  return withOrgScope(id, (tx) => tx.organisation.create({ data: { id, name, country: "NG" } }));
}

function createTestClient(orgId: string) {
  return withOrgScope(orgId, (tx) =>
    tx.client.create({
      data: { id: randomUUID(), orgId, name: `Client for ${orgId}`, paymentTerms: 14 },
    }),
  );
}

function createOverdueInvoice(orgId: string, clientId: string, number: string) {
  return withOrgScope(orgId, (tx) =>
    tx.invoice.create({
      data: {
        id: randomUUID(),
        orgId,
        number,
        clientId,
        status: "overdue",
        lineItems: [{ description: "Work", quantity: 1, unitPrice: 1000 }],
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
        currency: "NGN",
        dueDate: new Date("2026-01-01"),
        paymentPortalToken: randomUUID(),
      },
    }),
  );
}

describe("ask-vela tool executors — cross-tenant isolation", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it("get_outstanding_invoices never returns org B's invoices when executed scoped to org A", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const clientA = await createTestClient(orgA.id);
    const clientB = await createTestClient(orgB.id);
    await createOverdueInvoice(orgA.id, clientA.id, "INV-A001");
    await createOverdueInvoice(orgB.id, clientB.id, "INV-B001");

    const tool = getToolByName("get_outstanding_invoices")!;
    const result = await tool.execute(orgA.id, {});

    const data = result.data as { invoices: Array<{ number: string }> };
    expect(data.invoices.some((i) => i.number === "INV-A001")).toBe(true);
    expect(data.invoices.some((i) => i.number === "INV-B001")).toBe(false);
    expect(result.citations.some((c) => c.label.includes("INV-B001"))).toBe(false);
  });

  it("get_cash_position never returns org B's bank accounts when executed scoped to org A", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.bankAccount.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          provider: "mono",
          providerAccountId: `mono-acc-${orgB.id}`,
          institutionName: "Org B Bank",
          accountType: "savings",
          accountNumberMasked: "****0000",
          currency: "NGN",
          currentBalance: 999_999,
        },
      }),
    );

    const tool = getToolByName("get_cash_position")!;
    const result = await tool.execute(orgA.id, {});

    const data = result.data as { total: number; accounts: unknown[] };
    expect(data.total).toBe(0);
    expect(data.accounts).toHaveLength(0);
  });
});
