// Multi-branch — real DB, real HTTP layer. Proves branch CRUD is
// owner/admin-only, that assigning a staff member to a branch auto-tags
// their subsequent sales and cash checks with that branch (never
// client-selectable), and that the sales list's branch filter narrows
// correctly.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const ACCOUNT_SECRET = "correct-horse-battery-staple";

describe("Multi-branch (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerToken: string;
  let staffToken: string;
  let productId: string;
  let branchId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `branch-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Branch Test Org",
      name: "Owner",
      email,
      password: ACCOUNT_SECRET,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);

    const productRes = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Phone case",
        price: 1500,
        currency: "NGN",
        icon: "smartphone",
        color: "blue",
      });
    expect(productRes.status).toBe(201);
    productId = productRes.body.data.id;

    const staffPhone = `081${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
    const createStaffRes = await request(app)
      .post("/v1/organisation/staff")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Bisi", phone: staffPhone, role: "staff", pin: "1234" });
    expect(createStaffRes.status).toBe(201);

    const staffLoginRes = await request(app)
      .post("/v1/auth/staff/login")
      .send({ phone: staffPhone, pin: "1234", deviceId: "device-a" });
    expect(staffLoginRes.status).toBe(200);
    staffToken = staffLoginRes.body.data.accessToken;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    if (createdOrgIds.length > 0) {
      try {
        await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
      } catch (err) {
        // Best-effort cleanup only - a teardown failure here must never mask the
        // real pass/fail result of this file's actual assertions above.
        console.warn("org cleanup failed (non-fatal):", err);
      }
    }
    await prisma.$disconnect();
  });

  it(
    "staff cannot create or list branches — branch management is owner/admin only",
    async () => {
      const createRes = await request(app)
        .post("/v1/branches")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ name: "Ikeja shop" });
      expect(createRes.status).toBe(403);

      const listRes = await request(app)
        .get("/v1/branches")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(listRes.status).toBe(403);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "owner creates a branch, sees it listed, then assigns the staff member to it",
    async () => {
      const createRes = await request(app)
        .post("/v1/branches")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Ikeja shop", address: "12 Allen Ave" });
      expect(createRes.status).toBe(201);
      branchId = createRes.body.data.id;

      const listRes = await request(app)
        .get("/v1/branches")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((b: { id: string }) => b.id === branchId)).toBe(true);

      const staffListRes = await request(app)
        .get("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(staffListRes.status).toBe(200);
      const staffUserId = staffListRes.body.data.find(
        (u: { name: string }) => u.name === "Bisi",
      ).id;

      const assignRes = await request(app)
        .post(`/v1/branches/staff/${staffUserId}/assign`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ branchId });
      expect(assignRes.status).toBe(200);

      const staffListAfterRes = await request(app)
        .get("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerToken}`);
      const staffAfter = staffListAfterRes.body.data.find(
        (u: { id: string }) => u.id === staffUserId,
      );
      expect(staffAfter.branchId).toBe(branchId);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a sale logged by the now-assigned staff member is auto-tagged with their branch",
    async () => {
      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ items: [{ productId, quantity: 1 }] });
      expect(saleRes.status).toBe(201);
      expect(saleRes.body.data.branchId).toBe(branchId);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a cash check submitted by the assigned staff member is auto-tagged with their branch",
    async () => {
      const checkRes = await request(app)
        .post("/v1/cash-checks")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ countedAmount: 1500 });
      expect(checkRes.status).toBe(201);
      expect(checkRes.body.data.branchId).toBe(branchId);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the sales list's branchId filter narrows to only that branch's sales",
    async () => {
      const filteredRes = await request(app)
        .get(`/v1/sales?branchId=${branchId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(filteredRes.status).toBe(200);
      expect(filteredRes.body.data.items.length).toBeGreaterThan(0);
      expect(
        filteredRes.body.data.items.every((s: { branchId: string }) => s.branchId === branchId),
      ).toBe(true);

      const otherBranchFilteredRes = await request(app)
        .get(`/v1/sales?branchId=${randomUUID()}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(otherBranchFilteredRes.status).toBe(200);
      expect(otherBranchFilteredRes.body.data.items).toHaveLength(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "unassigning the staff member (branchId: null) stops future sales from being tagged",
    async () => {
      const staffListRes = await request(app)
        .get("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerToken}`);
      const staffUserId = staffListRes.body.data.find(
        (u: { name: string }) => u.name === "Bisi",
      ).id;

      const unassignRes = await request(app)
        .post(`/v1/branches/staff/${staffUserId}/assign`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ branchId: null });
      expect(unassignRes.status).toBe(200);

      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ items: [{ productId, quantity: 1 }] });
      expect(saleRes.status).toBe(201);
      expect(saleRes.body.data.branchId).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "deactivates a branch, which then drops out of the active listing",
    async () => {
      const deactivateRes = await request(app)
        .post(`/v1/branches/${branchId}/deactivate`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.data.isActive).toBe(false);

      const listRes = await request(app)
        .get("/v1/branches")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(listRes.body.data.some((b: { id: string }) => b.id === branchId)).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "assigning to an unknown branch id 404s",
    async () => {
      const staffListRes = await request(app)
        .get("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerToken}`);
      const staffUserId = staffListRes.body.data.find(
        (u: { name: string }) => u.name === "Bisi",
      ).id;

      const res = await request(app)
        .post(`/v1/branches/staff/${staffUserId}/assign`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ branchId: randomUUID() });
      expect(res.status).toBe(404);
    },
    TEST_TIMEOUT_MS,
  );
});
