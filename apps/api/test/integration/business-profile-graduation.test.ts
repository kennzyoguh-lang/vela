// Business profiling piece 4 — real DB, real HTTP layer. Proves: no prompt
// when usage doesn't contradict a factor, a prompt appears once usage
// crosses the threshold (2nd staff account; 3rd sale for the same customer
// name), confirming a prompt updates ONLY that one factor, and a
// mismatched factor/value pair is rejected.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
// These two tests make several sequential staff-creation/login/sale calls,
// each of which touches Redis (rate limiting, PIN lockout) — under normal
// conditions this is fast, but if Redis is unreachable every one of those
// calls pays a real retry/backoff cost before failing open (by design, see
// termii.gateway.ts-style "never blocks the primary action" contracts
// elsewhere), and that cost stacks up across 4-5 requests in one test.
const MULTI_REQUEST_TEST_TIMEOUT_MS = 90_000;

describe("Business profile graduation prompts (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `business-profile-graduation-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Business Profile Graduation Test Org",
      name: "Owner",
      email,
      password: "correct-horse-battery-staple",
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerAccessToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerAccessToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);

    const factorsRes = await request(app)
      .patch("/v1/organisation/business-profile/factors")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ customerPattern: "one_time", hasSalesStaff: "no", isCacRegistered: "unsure" });
    expect(factorsRes.status).toBe(200);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it(
    "shows no prompts before any contradicting usage exists",
    async () => {
      const res = await request(app)
        .get("/v1/organisation/business-profile/graduation-prompts")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "suggests hasSalesStaff=yes once a 2nd staff account exists",
    async () => {
      for (let i = 0; i < 2; i++) {
        const phone = `080${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
        const res = await request(app)
          .post("/v1/organisation/staff")
          .set("Authorization", `Bearer ${ownerAccessToken}`)
          .send({ name: `Staff ${i}`, phone, role: "staff", pin: "1234" });
        expect(res.status).toBe(201);
      }

      const promptsRes = await request(app)
        .get("/v1/organisation/business-profile/graduation-prompts")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(promptsRes.status).toBe(200);
      expect(promptsRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ factor: "hasSalesStaff", suggestedValue: "yes" }),
        ]),
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "confirming the hasSalesStaff prompt updates only that factor",
    async () => {
      const confirmRes = await request(app)
        .patch("/v1/organisation/business-profile/graduation-prompt")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ factor: "hasSalesStaff", value: "yes" });
      expect(confirmRes.status).toBe(200);

      const getRes = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(getRes.body.data.hasSalesStaff).toBe("yes");
      expect(getRes.body.data.customerPattern).toBe("one_time"); // untouched
      expect(getRes.body.data.isCacRegistered).toBe("unsure"); // untouched
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "suggests customerPattern=repeat once the same customer name appears 3+ times, and confirming it updates only that factor",
    async () => {
      const productRes = await request(app)
        .post("/v1/products")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Item", price: 500, currency: "NGN", icon: "package", color: "blue" });
      expect(productRes.status).toBe(201);
      const productId = productRes.body.data.id;

      const staffPhone = `081${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const createStaffRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Repeat Customer Staff", phone: staffPhone, role: "staff", pin: "5678" });
      expect(createStaffRes.status).toBe(201);
      const staffLoginRes = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: "5678", deviceId: "device-graduation-test" });
      expect(staffLoginRes.status).toBe(200);
      const staffAccessToken = staffLoginRes.body.data.accessToken;

      for (let i = 0; i < 3; i++) {
        const saleRes = await request(app)
          .post("/v1/sales")
          .set("Authorization", `Bearer ${staffAccessToken}`)
          .send({ items: [{ productId, quantity: 1 }], customerName: "Regular Chidi" });
        expect(saleRes.status).toBe(201);
      }

      const promptsRes = await request(app)
        .get("/v1/organisation/business-profile/graduation-prompts")
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(promptsRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ factor: "customerPattern", suggestedValue: "repeat" }),
        ]),
      );

      const confirmRes = await request(app)
        .patch("/v1/organisation/business-profile/graduation-prompt")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ factor: "customerPattern", value: "repeat" });
      expect(confirmRes.status).toBe(200);

      const getRes = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(getRes.body.data.customerPattern).toBe("repeat");
      expect(getRes.body.data.hasSalesStaff).toBe("yes"); // untouched from the prior test
    },
    MULTI_REQUEST_TEST_TIMEOUT_MS,
  );

  it(
    "rejects a mismatched factor/value pair",
    async () => {
      const res = await request(app)
        .patch("/v1/organisation/business-profile/graduation-prompt")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ factor: "hasSalesStaff", value: "repeat" });

      expect(res.status).toBe(422);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "staff cannot read or confirm graduation prompts — owner/admin only",
    async () => {
      const staffPhone = `082${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const createStaffRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "RBAC Test Staff", phone: staffPhone, role: "staff", pin: "9012" });
      expect(createStaffRes.status).toBe(201);
      const staffLoginRes = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: "9012", deviceId: "device-graduation-rbac-test" });
      expect(staffLoginRes.status).toBe(200);
      const staffAccessToken = staffLoginRes.body.data.accessToken;

      const getRes = await request(app)
        .get("/v1/organisation/business-profile/graduation-prompts")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      expect(getRes.status).toBe(403);

      const confirmRes = await request(app)
        .patch("/v1/organisation/business-profile/graduation-prompt")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ factor: "hasSalesStaff", value: "yes" });
      expect(confirmRes.status).toBe(403);
    },
    MULTI_REQUEST_TEST_TIMEOUT_MS,
  );
});
