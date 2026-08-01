// Anti-theft/POS feature: sale logging by a phone+PIN-authenticated staff
// user. Real DB, real HTTP layer — proves the RBAC gating on /v1/products
// and /v1/sales (staff can list/sell, cannot manage the catalog) and, most
// importantly, that the sale total is computed from the server-side
// catalog price, never anything the client sends.
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

describe("POS sale logging (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let staffAccessToken: string;
  let productId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `pos-sale-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "POS Sale Test Org",
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
    "staff can list the product catalog for the sale-logging grid",
    async () => {
      const res = await request(app)
        .get("/v1/products")
        .set("Authorization", `Bearer ${staffAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((p: { id: string }) => p.id === productId)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "staff cannot create a product — catalog management is owner/admin only",
    async () => {
      const res = await request(app)
        .post("/v1/products")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ name: "Charger", price: 3000, currency: "NGN", icon: "zap", color: "amber" });

      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "logging a sale computes the total from the server-known catalog price, never a client-sent one",
    async () => {
      const res = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 3, price: 1 }] }); // "price" isn't a real field — must be ignored

      expect(res.status).toBe(201);
      expect(Number(res.body.data.total)).toBe(4500); // 1500 * 3, the real catalog price
      expect(res.body.data.items[0].productName).toBe("Phone case");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "decrements stockQuantity by the sold quantity, clamped at 0, when the product opted into stock tracking",
    async () => {
      const stockedProductRes = await request(app)
        .post("/v1/products")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({
          name: "USB Cable",
          price: 500,
          currency: "NGN",
          icon: "zap",
          color: "amber",
          stockQuantity: 5,
        });
      expect(stockedProductRes.status).toBe(201);
      const stockedProductId = stockedProductRes.body.data.id;

      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId: stockedProductId, quantity: 2 }] });
      expect(saleRes.status).toBe(201);

      const afterFirstSale = await request(app)
        .get("/v1/products")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      const productAfterFirstSale = afterFirstSale.body.data.find(
        (p: { id: string }) => p.id === stockedProductId,
      );
      expect(productAfterFirstSale.stockQuantity).toBe(3);

      // Oversell the remaining stock (3 left, sell 10) — must clamp at 0,
      // never go negative.
      const oversellRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId: stockedProductId, quantity: 10 }] });
      expect(oversellRes.status).toBe(201);

      const afterOversell = await request(app)
        .get("/v1/products")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      const productAfterOversell = afterOversell.body.data.find(
        (p: { id: string }) => p.id === stockedProductId,
      );
      expect(productAfterOversell.stockQuantity).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "never sets stockQuantity on a product that didn't opt into stock tracking",
    async () => {
      // productId (Phone case, created in beforeAll) never had stockQuantity set.
      const saleRes = await request(app)
        .post("/v1/sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ items: [{ productId, quantity: 1 }] });
      expect(saleRes.status).toBe(201);

      const res = await request(app)
        .get("/v1/products")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      const product = res.body.data.find((p: { id: string }) => p.id === productId);
      expect(product.stockQuantity).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );
});
