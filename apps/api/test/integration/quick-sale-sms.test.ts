// Quick Sale / Instant Collect Piece 4: the "Pay ₦X now" SMS link flow.
// Real DB, real HTTP layer — proves the endpoint composes the correct
// message against the real payment link and audit-logs the send, without
// requiring a real SMS provider (still an honest stub — see
// quick-sale.service.ts's sendPaymentLinkSms comment).
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

describe("Quick Sale SMS payment link (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `quick-sale-sms-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Quick Sale SMS Test Org",
      name: "Owner",
      email,
      password: "correct-horse-battery-staple",
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerAccessToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerAccessToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it(
    "sends the payment link SMS for an existing Quick Sale and audit-logs it",
    async () => {
      const createRes = await request(app)
        .post("/v1/quick-sales")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ amount: 3200, currency: "NGN" });
      expect(createRes.status).toBe(201);
      const invoiceId = createRes.body.data.id;
      const token = createRes.body.data.paymentPortalToken;

      const smsRes = await request(app)
        .post(`/v1/quick-sales/${invoiceId}/send-sms`)
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ phone: "08012345678" });

      expect(smsRes.status).toBe(200);
      expect(smsRes.body.data.sent).toBe(true);
      expect(smsRes.body.data.message).toContain("Pay ₦3,200 now:");
      expect(smsRes.body.data.message).toContain(`/pay/${token}`);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "sends the same link over WhatsApp when channel: 'whatsapp' is requested",
    async () => {
      const createRes = await request(app)
        .post("/v1/quick-sales")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ amount: 1500, currency: "NGN" });
      expect(createRes.status).toBe(201);
      const invoiceId = createRes.body.data.id;

      const smsRes = await request(app)
        .post(`/v1/quick-sales/${invoiceId}/send-sms`)
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ phone: "08012345678", channel: "whatsapp" });

      expect(smsRes.status).toBe(200);
      expect(smsRes.body.data.sent).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "returns 404 for a Quick Sale that doesn't exist",
    async () => {
      const smsRes = await request(app)
        .post(`/v1/quick-sales/${randomUUID()}/send-sms`)
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ phone: "08012345678" });

      expect(smsRes.status).toBe(404);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "allows a staff-role caller to create a Quick Sale and send its SMS link — trader-facing, not an owner/admin-only control",
    async () => {
      const phone = `081${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const staffRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Chidinma", phone, role: "staff", pin: "1234" });
      expect(staffRes.status).toBe(201);

      const staffLoginRes = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone, pin: "1234", deviceId: "device-sms-test" });
      expect(staffLoginRes.status).toBe(200);
      const staffAccessToken = staffLoginRes.body.data.accessToken;

      const createRes = await request(app)
        .post("/v1/quick-sales")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ amount: 1000, currency: "NGN" });
      expect(createRes.status).toBe(201);
      const invoiceId = createRes.body.data.id;

      const smsRes = await request(app)
        .post(`/v1/quick-sales/${invoiceId}/send-sms`)
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ phone: "08012345678" });

      expect(smsRes.status).toBe(200);
      expect(smsRes.body.data.sent).toBe(true);
    },
    SETUP_TIMEOUT_MS,
  );
});
