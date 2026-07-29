// Security review finding: every mutating route outside organisation
// management was gated by requireAuth alone, never requireRole — a
// view_only/staff user could run payroll, edit employees, or void invoices.
// This test goes through the real Express app (supertest), not just the
// service layer, because the gap was specifically in the routing/middleware
// wiring, not the business logic underneath it.
import request from "supertest";
import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";

// Deliberately no beforeAll setting DATABASE_URL/APP_DATABASE_URL fallbacks
// here (unlike the mocked unit tests) — this is a real-DB integration test,
// and Prisma's own .env loading needs to populate the real Supabase
// credentials; pre-setting a placeholder via `??=` would win the race and
// silently point this test at a nonexistent local database instead.
describe("RBAC — sensitive mutations require owner/admin", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  async function createOrgAndUser(role: "owner" | "admin" | "staff" | "view_only") {
    const { withOrgScope } = await import("../../src/lib/prisma");
    const orgId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.organisation.create({ data: { id: orgId, name: "RBAC Test Org", country: "NG" } }),
    );
    createdOrgIds.push(orgId);
    const userId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.user.create({
        data: {
          id: userId,
          orgId,
          name: `${role} user`,
          email: `${role}-${orgId}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role,
        },
      }),
    );
    const { signAccessToken } = await import("../../src/services/jwt.service");
    const token = signAccessToken({ sub: userId, orgId, role, sessionFamilyId: randomUUID() });
    return { orgId, userId, token };
  }

  it("a staff-role user cannot run payroll (403)", async () => {
    const { createApp } = await import("../../src/app");
    const { token } = await createOrgAndUser("staff");

    const res = await request(createApp())
      .post("/v1/payroll-runs/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodLabel: "2026-07" });

    expect(res.status).toBe(403);
  });

  it("a view_only user cannot create an employee (403)", async () => {
    const { createApp } = await import("../../src/app");
    const { token } = await createOrgAndUser("view_only");

    const res = await request(createApp())
      .post("/v1/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Employee",
        jobTitle: "Engineer",
        employmentType: "full_time",
        basicSalary: 100000,
        startDate: "2026-01-01",
      });

    expect(res.status).toBe(403);
  });

  it("a staff-role user cannot void an invoice (403)", async () => {
    const { createApp } = await import("../../src/app");
    const { token } = await createOrgAndUser("staff");

    const res = await request(createApp())
      .post(`/v1/invoices/${randomUUID()}/void`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "test" });

    expect(res.status).toBe(403);
  });

  it("an admin-role user CAN run payroll (not blocked by RBAC, even if it 4xx/201s for other reasons)", async () => {
    const { createApp } = await import("../../src/app");
    const { token } = await createOrgAndUser("admin");

    const res = await request(createApp())
      .post("/v1/payroll-runs/run")
      .set("Authorization", `Bearer ${token}`)
      .send({ periodLabel: "2026-07" });

    expect(res.status).not.toBe(403);
  });
});
