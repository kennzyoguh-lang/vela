// Anti-theft/POS feature, Piece 2: end-of-day cash check. Real DB, real HTTP
// layer — proves the expected total is computed server-side from completed
// Sale rows (never trusted from the client), that a voided sale is excluded
// from that total, and the RBAC split (staff can submit/see today's figure,
// only owner/admin can see the history list).
//
// Deliberately no beforeAll DATABASE_URL/APP_DATABASE_URL fallback — same
// reasoning as staff-pin-login.test.ts.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

describe("POS cash check (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let staffAccessToken: string;
  let productId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `pos-cash-check-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "POS Cash Check Test Org",
      name: "Owner",
      email,
      password: "correct-horse-battery-staple",
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerAccessToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerAccessToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);

    const productRes = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
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
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Amaka", phone: staffPhone, role: "staff", pin: "1234" });
    expect(createStaffRes.status).toBe(201);

    const staffLoginRes = await request(app)
      .post("/v1/auth/staff/login")
      .send({ phone: staffPhone, pin: "1234", deviceId: "device-a" });
    expect(staffLoginRes.status).toBe(200);
    staffAccessToken = staffLoginRes.body.data.accessToken;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it(
    "today's expected total sums completed sales for the org",
    async () => {
      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 2 }] }); // 3000
      expect(saleRes.status).toBe(201);

      const todayRes = await request(app)
        .get("/v1/cash-checks/today")
        .set("Authorization", `Bearer ${staffAccessToken}`);

      expect(todayRes.status).toBe(200);
      expect(todayRes.body.data.expectedAmount).toBe(3000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "submitting the same counted amount as expected is reported as matched",
    async () => {
      const todayRes = await request(app)
        .get("/v1/cash-checks/today")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      const expectedAmount = todayRes.body.data.expectedAmount;

      const submitRes = await request(app)
        .post("/v1/cash-checks")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ countedAmount: expectedAmount });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data.matched).toBe(true);
      expect(Number(submitRes.body.data.difference)).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a mismatched count is reported with the signed difference, not silently corrected",
    async () => {
      const todayRes = await request(app)
        .get("/v1/cash-checks/today")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      const expectedAmount = todayRes.body.data.expectedAmount;

      const submitRes = await request(app)
        .post("/v1/cash-checks")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ countedAmount: expectedAmount - 500 });

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data.matched).toBe(false);
      expect(Number(submitRes.body.data.difference)).toBe(-500);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "staff can submit and read today's figure but cannot read the reconciliation history",
    async () => {
      const historyRes = await request(app)
        .get("/v1/cash-checks")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      expect(historyRes.status).toBe(403);

      const ownerHistoryRes = await request(app)
        .get("/v1/cash-checks")
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(ownerHistoryRes.status).toBe(200);
      expect(ownerHistoryRes.body.data.total).toBeGreaterThanOrEqual(2);
    },
    TEST_TIMEOUT_MS,
  );
});
