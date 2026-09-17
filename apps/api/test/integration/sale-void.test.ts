// Voiding a Quick Sale — SaleStatus has had "voided" as a value since the
// POS feature shipped, but nothing ever let anyone actually set it
// (sale.service.ts#voidSale's own comment explains the gap). Proves the
// real-DB round trip end to end: a staff member cannot void their own
// sale, an owner can, a second void attempt is rejected, and the voided
// sale drops out of the staff leaderboard's sales total immediately.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const ACCOUNT_SECRET = "correct-horse-battery-staple";

describe("Sale voiding (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let staffAccessToken: string;
  let orgId: string;
  let productId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `sale-void-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Sale Void Test Org",
      name: "Owner",
      email,
      password: ACCOUNT_SECRET,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerAccessToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerAccessToken) as { orgId: string };
    orgId = claims.orgId;
    createdOrgIds.push(orgId);

    const productRes = await request(app)
      .post("/v1/products")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Notebook", price: 2000, currency: "NGN", icon: "package", color: "blue" });
    expect(productRes.status).toBe(201);
    productId = productRes.body.data.id;

    const staffPhone = `080${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
    const createStaffRes = await request(app)
      .post("/v1/organisation/staff")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Tunde", phone: staffPhone, role: "staff", pin: "1234" });
    expect(createStaffRes.status).toBe(201);

    const staffLoginRes = await request(app)
      .post("/v1/auth/staff/login")
      .send({ phone: staffPhone, pin: "1234", deviceId: "device-void-test" });
    expect(staffLoginRes.status).toBe(200);
    staffAccessToken = staffLoginRes.body.data.accessToken;
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
    "a staff member cannot void a sale, but an owner can — and a voided sale drops out of the leaderboard total",
    async () => {
      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 2 }] });
      expect(saleRes.status).toBe(201);
      const saleId = saleRes.body.data.id;

      const from = new Date();
      from.setUTCDate(1);
      const to = new Date(from);
      to.setUTCMonth(to.getUTCMonth() + 1);
      const rangeQuery = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;

      const beforeLeaderboardRes = await request(app)
        .get(`/v1/staff-leaderboard?${rangeQuery}`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(beforeLeaderboardRes.status).toBe(200);
      const beforeEntry = beforeLeaderboardRes.body.data.find(
        (e: { salesTotal: number }) => e.salesTotal === 4000,
      );
      expect(beforeEntry).toBeDefined();

      const staffVoidRes = await request(app)
        .post(`/v1/sales/${saleId}/void`)
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ reason: "Trying to void my own sale" });
      expect(staffVoidRes.status).toBe(403);

      const ownerVoidRes = await request(app)
        .post(`/v1/sales/${saleId}/void`)
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ reason: "Customer changed their mind before paying" });
      expect(ownerVoidRes.status).toBe(200);
      expect(ownerVoidRes.body.data.status).toBe("voided");

      const secondVoidRes = await request(app)
        .post(`/v1/sales/${saleId}/void`)
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ reason: "Trying again" });
      expect(secondVoidRes.status).toBe(422);

      const afterLeaderboardRes = await request(app)
        .get(`/v1/staff-leaderboard?${rangeQuery}`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      const afterEntry = afterLeaderboardRes.body.data.find(
        (e: { staffUserId: string }) => e.staffUserId === beforeEntry.staffUserId,
      );
      expect(afterEntry?.salesTotal ?? 0).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
