// Anti-theft/POS feature, Piece 4: staff-proof discount approval. Real DB,
// real HTTP layer — proves a staff-role discount is blocked without the
// org's shared approval PIN, rejected on a wrong PIN, accepted on a correct
// one, and that owner/admin never need the PIN for their own discount.
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

describe("Discount approval guardrail (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let staffAccessToken: string;
  let productId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `discount-approval-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Discount Approval Test Org",
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
    "staff discount is blocked with a friendly message before an owner sets an approval PIN",
    async () => {
      const res = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 1 }], discountAmount: 200 });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/ask your manager to set up/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "owner sets the approval PIN, then a staff discount without a PIN is still blocked",
    async () => {
      const setPinRes = await request(app)
        .patch("/v1/organisation/discount-approval-pin")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ pin: "9999" });
      expect(setPinRes.status).toBe(200);

      const res = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 1 }], discountAmount: 200 });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/ask your manager to approve/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a wrong approval PIN is rejected with the same friendly message, not a technical error",
    async () => {
      const res = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 1 }], discountAmount: 200, approvalPin: "0000" });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/ask your manager to approve/i);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the correct approval PIN applies the discount and the total reflects it",
    async () => {
      const res = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 2 }], discountAmount: 500, approvalPin: "9999" }); // subtotal 3000

      expect(res.status).toBe(201);
      expect(Number(res.body.data.total)).toBe(2500);
      expect(Number(res.body.data.discountAmount)).toBe(500);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "owner applying their own discount needs no approval PIN at all",
    async () => {
      const res = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ items: [{ productId, quantity: 1 }], discountAmount: 100 }); // subtotal 1500

      expect(res.status).toBe(201);
      expect(Number(res.body.data.total)).toBe(1400);
      expect(Number(res.body.data.discountAmount)).toBe(100);
    },
    TEST_TIMEOUT_MS,
  );
});
