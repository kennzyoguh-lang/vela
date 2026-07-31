// Anti-theft/POS feature, Piece 3: owner daily summary. Real DB, real HTTP
// layer — proves the endpoint aggregates today's completed sales and the
// day's cash check into the right status, and that it's owner/admin only
// (the whole point is a dashboard-login banner, not something POS staff see).
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

describe("Owner daily summary (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let staffAccessToken: string;
  let productId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `owner-summary-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Owner Summary Test Org",
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
    "is pending (no cash figures) before any sale is logged today",
    async () => {
      const res = await request(app)
        .get("/v1/owner-summary/today")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.salesCount).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "reflects a logged sale in the expected total before any cash check",
    async () => {
      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 2 }] }); // 3000
      expect(saleRes.status).toBe(201);

      const res = await request(app)
        .get("/v1/owner-summary/today")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("pending");
      expect(res.body.data.salesCount).toBe(1);
      expect(res.body.data.expectedAmount).toBe(3000);
      expect(res.body.data.countedAmount).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "flips to 'shortfall' once a mismatched cash check is submitted",
    async () => {
      const submitRes = await request(app)
        .post("/v1/cash-checks")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ countedAmount: 2500 }); // 500 short of 3000
      expect(submitRes.status).toBe(201);

      const res = await request(app)
        .get("/v1/owner-summary/today")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("shortfall");
      expect(res.body.data.countedAmount).toBe(2500);
      expect(res.body.data.difference).toBe(-500);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "is owner/admin only — staff (the POS role) gets a 403",
    async () => {
      const res = await request(app)
        .get("/v1/owner-summary/today")
        .set("Authorization", `Bearer ${staffAccessToken}`);

      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT_MS,
  );
});
