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
import * as accountantLinkRepo from "../../src/repositories/accountant-link.repository";
import * as accountantPortalService from "../../src/services/accountant-portal.service";

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

  // Accountant Portal (Phase 6) fulfils the promise the placeholder test above
  // anticipated: a new accountant_client_links table, isolated exactly like
  // every other org-scoped table, plus an application-layer access check
  // (never a loosened RLS policy — Handbook 6.3) gating cross-org reads.
  it("never returns org B's accountant_client_links rows while scoped to org A", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await accountantLinkRepo.create(orgB.id, {
      accountantEmail: `accountant-${orgB.id}@example.com`,
      invitedBy: randomUUID(),
    });

    const rows = await withOrgScope(orgA.id, (tx) => tx.accountantClientLink.findMany({}));

    expect(rows.every((l) => l.orgId === orgA.id)).toBe(true);
    expect(rows.some((l) => l.orgId === orgB.id)).toBe(false);
  });

  it("an active accountant link grants scoped read access to exactly that client org", async () => {
    const clientOrg = await createTestOrg("Client Org");
    const accountantOrg = await createTestOrg("Accountant Org");
    createdOrgIds.push(clientOrg.id, accountantOrg.id);

    const accountantUser = await withOrgScope(accountantOrg.id, (tx) =>
      tx.user.create({
        data: {
          orgId: accountantOrg.id,
          name: "Accountant",
          email: `accountant-${accountantOrg.id}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "owner",
        },
      }),
    );

    const link = await accountantLinkRepo.create(clientOrg.id, {
      accountantEmail: accountantUser.email,
      invitedBy: randomUUID(),
    });
    await accountantLinkRepo.accept(clientOrg.id, link.id, accountantUser.id);

    const summary = await accountantPortalService.getClientOrgSummary(
      accountantUser.id,
      clientOrg.id,
    );
    expect(summary.orgName).toBe("Client Org");
  });

  it("a revoked accountant link denies read access to the client org summary", async () => {
    const clientOrg = await createTestOrg("Client Org");
    const accountantOrg = await createTestOrg("Accountant Org");
    createdOrgIds.push(clientOrg.id, accountantOrg.id);

    const accountantUser = await withOrgScope(accountantOrg.id, (tx) =>
      tx.user.create({
        data: {
          orgId: accountantOrg.id,
          name: "Accountant",
          email: `accountant-${accountantOrg.id}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "owner",
        },
      }),
    );

    const link = await accountantLinkRepo.create(clientOrg.id, {
      accountantEmail: accountantUser.email,
      invitedBy: randomUUID(),
    });
    await accountantLinkRepo.accept(clientOrg.id, link.id, accountantUser.id);
    await accountantLinkRepo.revoke(clientOrg.id, link.id);

    await expect(
      accountantPortalService.getClientOrgSummary(accountantUser.id, clientOrg.id),
    ).rejects.toThrow(/don't have access/);
  });

  it("no accountant link at all denies read access to the client org summary", async () => {
    const clientOrg = await createTestOrg("Client Org");
    const accountantOrg = await createTestOrg("Accountant Org");
    createdOrgIds.push(clientOrg.id, accountantOrg.id);

    const accountantUser = await withOrgScope(accountantOrg.id, (tx) =>
      tx.user.create({
        data: {
          orgId: accountantOrg.id,
          name: "Unlinked Accountant",
          email: `unlinked-${accountantOrg.id}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "owner",
        },
      }),
    );

    await expect(
      accountantPortalService.getClientOrgSummary(accountantUser.id, clientOrg.id),
    ).rejects.toThrow(/don't have access/);
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

  // ComplianceRadar (Phase 3) introduced org_compliance_obligations/
  // compliance_filings as new org-scoped tables — same isolation guarantee,
  // extended rather than assumed to carry over automatically.
  it("never returns org B's compliance obligations while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.orgComplianceObligation.create({
        data: { id: randomUUID(), orgId: orgB.id, obligationType: "vat", isActive: true },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.orgComplianceObligation.findMany({}));

    expect(rows.every((o) => o.orgId === orgA.id)).toBe(true);
    expect(rows.some((o) => o.orgId === orgB.id)).toBe(false);
  });

  it("never returns org B's compliance filings while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.complianceFiling.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          obligationType: "vat",
          periodLabel: "2026-07",
          dueDate: new Date("2026-08-21"),
        },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.complianceFiling.findMany({}));

    expect(rows.every((f) => f.orgId === orgA.id)).toBe(true);
    expect(rows.some((f) => f.orgId === orgB.id)).toBe(false);
  });

  it("org A cannot mutate org B's compliance filing by guessing its id", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const filingB = await withOrgScope(orgB.id, (tx) =>
      tx.complianceFiling.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          obligationType: "vat",
          periodLabel: "2026-07",
          dueDate: new Date("2026-08-21"),
        },
      }),
    );

    await expect(
      withOrgScope(orgA.id, (tx) =>
        tx.complianceFiling.update({
          where: { id: filingB.id, orgId: orgA.id },
          data: { filedAt: new Date() },
        }),
      ),
    ).rejects.toThrow();

    const stillUnfiled = await withOrgScope(orgB.id, (tx) =>
      tx.complianceFiling.findUnique({ where: { id: filingB.id } }),
    );
    expect(stillUnfiled?.filedAt).toBeNull();
  });

  // P&L Intelligence (Phase 4) introduced bank_accounts/bank_transactions as
  // new org-scoped tables — same isolation guarantee, extended rather than
  // assumed to carry over automatically.
  it("never returns org B's bank accounts while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.bankAccount.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          provider: "mono",
          providerAccountId: "mono-acc-b",
          institutionName: "Org B Bank",
          accountType: "savings",
          accountNumberMasked: "****1234",
          currency: "NGN",
        },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.bankAccount.findMany({}));

    expect(rows.every((a) => a.orgId === orgA.id)).toBe(true);
    expect(rows.some((a) => a.orgId === orgB.id)).toBe(false);
  });

  it("never returns org B's bank transactions while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const accountB = await withOrgScope(orgB.id, (tx) =>
      tx.bankAccount.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          provider: "mono",
          providerAccountId: "mono-acc-b2",
          institutionName: "Org B Bank",
          accountType: "savings",
          accountNumberMasked: "****5678",
          currency: "NGN",
        },
      }),
    );
    await withOrgScope(orgB.id, (tx) =>
      tx.bankTransaction.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          bankAccountId: accountB.id,
          providerTransactionId: "mono-tx-b1",
          type: "debit",
          amount: 5000,
          narration: "Org B expense",
          transactionDate: new Date("2026-07-15"),
        },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.bankTransaction.findMany({}));

    expect(rows.every((t) => t.orgId === orgA.id)).toBe(true);
    expect(rows.some((t) => t.orgId === orgB.id)).toBe(false);
  });

  it("org A cannot mutate org B's bank transaction by guessing its id", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const accountB = await withOrgScope(orgB.id, (tx) =>
      tx.bankAccount.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          provider: "mono",
          providerAccountId: "mono-acc-b3",
          institutionName: "Org B Bank",
          accountType: "savings",
          accountNumberMasked: "****9012",
          currency: "NGN",
        },
      }),
    );
    const transactionB = await withOrgScope(orgB.id, (tx) =>
      tx.bankTransaction.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          bankAccountId: accountB.id,
          providerTransactionId: "mono-tx-b2",
          type: "debit",
          amount: 5000,
          narration: "Org B expense",
          transactionDate: new Date("2026-07-15"),
        },
      }),
    );

    await expect(
      withOrgScope(orgA.id, (tx) =>
        tx.bankTransaction.update({
          where: { id: transactionB.id, orgId: orgA.id },
          data: { category: "income" },
        }),
      ),
    ).rejects.toThrow();

    const stillUncategorized = await withOrgScope(orgB.id, (tx) =>
      tx.bankTransaction.findUnique({ where: { id: transactionB.id } }),
    );
    expect(stillUncategorized?.category).toBe("uncategorized");
  });

  // PeopleHub (Phase 5) introduced employees/payroll_runs/payslips as new
  // org-scoped tables — same isolation guarantee, extended rather than
  // assumed to carry over automatically.
  it("never returns org B's employees while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    await withOrgScope(orgB.id, (tx) =>
      tx.employee.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          name: "Org B Employee",
          jobTitle: "Engineer",
          employmentType: "full_time",
          basicSalary: 200_000,
          startDate: new Date("2026-01-01"),
        },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.employee.findMany({}));

    expect(rows.every((e) => e.orgId === orgA.id)).toBe(true);
    expect(rows.some((e) => e.orgId === orgB.id)).toBe(false);
  });

  it("never returns org B's payroll runs or payslips while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const employeeB = await withOrgScope(orgB.id, (tx) =>
      tx.employee.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          name: "Org B Employee",
          jobTitle: "Engineer",
          employmentType: "full_time",
          basicSalary: 200_000,
          startDate: new Date("2026-01-01"),
        },
      }),
    );
    const runB = await withOrgScope(orgB.id, (tx) =>
      tx.payrollRun.create({
        data: { id: randomUUID(), orgId: orgB.id, periodLabel: "2026-07" },
      }),
    );
    await withOrgScope(orgB.id, (tx) =>
      tx.payslip.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          payrollRunId: runB.id,
          employeeId: employeeB.id,
          grossPay: 280_000,
          paye: 10_000,
          employeePension: 22_400,
          employerPension: 28_000,
          nhf: 5_000,
          netPay: 242_600,
        },
      }),
    );

    const runRows = await withOrgScope(orgA.id, (tx) => tx.payrollRun.findMany({}));
    const payslipRows = await withOrgScope(orgA.id, (tx) => tx.payslip.findMany({}));

    expect(runRows.every((r) => r.orgId === orgA.id)).toBe(true);
    expect(runRows.some((r) => r.orgId === orgB.id)).toBe(false);
    expect(payslipRows.every((p) => p.orgId === orgA.id)).toBe(true);
    expect(payslipRows.some((p) => p.orgId === orgB.id)).toBe(false);
  });

  it("org A cannot mutate org B's payroll run by guessing its id", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const runB = await withOrgScope(orgB.id, (tx) =>
      tx.payrollRun.create({
        data: { id: randomUUID(), orgId: orgB.id, periodLabel: "2026-07" },
      }),
    );

    await expect(
      withOrgScope(orgA.id, (tx) =>
        tx.payrollRun.update({
          where: { id: runB.id, orgId: orgA.id },
          data: { status: "paid" },
        }),
      ),
    ).rejects.toThrow();

    const stillDraft = await withOrgScope(orgB.id, (tx) =>
      tx.payrollRun.findUnique({ where: { id: runB.id } }),
    );
    expect(stillDraft?.status).toBe("draft");
  });

  // Ask Vela (Phase 7) introduced ask_vela_conversations/ask_vela_messages as
  // new org-scoped tables — same isolation guarantee, extended rather than
  // assumed to carry over automatically. Unlike Accountant Portal, there is
  // no cross-org exception here at all: the assistant only ever answers
  // within the caller's own org.
  it("never returns org B's Ask Vela conversations while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const userB = await withOrgScope(orgB.id, (tx) =>
      tx.user.create({
        data: {
          orgId: orgB.id,
          name: "Org B Owner",
          email: `org-b-owner-askvela-${orgB.id}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "owner",
        },
      }),
    );
    await withOrgScope(orgB.id, (tx) =>
      tx.askVelaConversation.create({
        data: { id: randomUUID(), orgId: orgB.id, userId: userB.id },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.askVelaConversation.findMany({}));

    expect(rows.every((c) => c.orgId === orgA.id)).toBe(true);
    expect(rows.some((c) => c.orgId === orgB.id)).toBe(false);
  });

  it("never returns org B's Ask Vela messages while scoped to org A, even querying without an org_id filter", async () => {
    const orgA = await createTestOrg("Org A");
    const orgB = await createTestOrg("Org B");
    createdOrgIds.push(orgA.id, orgB.id);

    const userB = await withOrgScope(orgB.id, (tx) =>
      tx.user.create({
        data: {
          orgId: orgB.id,
          name: "Org B Owner",
          email: `org-b-owner-askvela-msg-${orgB.id}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "owner",
        },
      }),
    );
    const conversationB = await withOrgScope(orgB.id, (tx) =>
      tx.askVelaConversation.create({
        data: { id: randomUUID(), orgId: orgB.id, userId: userB.id },
      }),
    );
    await withOrgScope(orgB.id, (tx) =>
      tx.askVelaMessage.create({
        data: {
          id: randomUUID(),
          orgId: orgB.id,
          conversationId: conversationB.id,
          role: "user",
          content: "What's my cash position?",
        },
      }),
    );

    const rows = await withOrgScope(orgA.id, (tx) => tx.askVelaMessage.findMany({}));

    expect(rows.every((m) => m.orgId === orgA.id)).toBe(true);
    expect(rows.some((m) => m.orgId === orgB.id)).toBe(false);
  });
});
