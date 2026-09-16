// F-57: Quotes/Estimates end-to-end — proves the full create -> send ->
// public-portal-view -> accept/decline -> convert-to-invoice lifecycle
// against the real Express app, real DB, and real RLS (including the
// resolve_org_for_quote_token SECURITY DEFINER function, which a mocked
// unit test can't exercise). Mirrors owner-summary.test.ts's shape.
//
// Deliberately no beforeAll DATABASE_URL/APP_DATABASE_URL fallback — same
// reasoning as staff-pin-login.test.ts.
import request from "supertest";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const TEST_FIXTURE_PASSWORD = "correct-horse-battery-staple";

describe("Quote lifecycle (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let clientId: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `quote-lifecycle-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Quote Lifecycle Test Org",
      name: "Owner",
      email,
      password: TEST_FIXTURE_PASSWORD,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerAccessToken = signupRes.body.data.accessToken;
    createdOrgIds.push(signupRes.body.data.orgId);

    const clientRes = await request(app)
      .post("/v1/clients")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Chinedu Furniture", email: "chinedu@example.com" });
    expect(clientRes.status).toBe(201);
    clientId = clientRes.body.data.id;
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
    "creates a draft quote with a computed subtotal/total",
    async () => {
      const res = await request(app)
        .post("/v1/quotes")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({
          clientId,
          validUntil: "2026-12-31",
          lineItems: [{ description: "Dining table", quantity: 1, unitPrice: 250_000 }],
          tax: 0,
          discount: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("draft");
      expect(res.body.data.number).toMatch(/^QUO-\d{4}$/);
      expect(Number(res.body.data.total)).toBe(250_000);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "sends a quote, then the public portal can view and accept it, then it converts to an invoice",
    async () => {
      const createRes = await request(app)
        .post("/v1/quotes")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({
          clientId,
          validUntil: "2026-12-31",
          lineItems: [{ description: "Bookshelf", quantity: 2, unitPrice: 60_000 }],
          tax: 0,
          discount: 0,
        });
      expect(createRes.status).toBe(201);
      const quoteId = createRes.body.data.id;

      const sendRes = await request(app)
        .post(`/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(sendRes.status).toBe(200);
      expect(sendRes.body.data.status).toBe("sent");
      const portalToken = sendRes.body.data.portalToken;

      // Public portal — no Authorization header at all.
      const portalViewRes = await request(app).get(`/v1/quote-portal/${portalToken}`);
      expect(portalViewRes.status).toBe(200);
      expect(portalViewRes.body.data.number).toBe(sendRes.body.data.number);
      expect(Number(portalViewRes.body.data.total)).toBe(120_000);
      expect(portalViewRes.body.data.clientName).toBe("Chinedu Furniture");

      const acceptRes = await request(app).post(`/v1/quote-portal/${portalToken}/accept`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe("accepted");

      const convertRes = await request(app)
        .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(convertRes.status).toBe(201);
      expect(Number(convertRes.body.data.total)).toBe(120_000);
      expect(convertRes.body.data.clientId).toBe(clientId);

      // A second conversion attempt must be rejected, not silently repeated.
      const secondConvertRes = await request(app)
        .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(secondConvertRes.status).toBe(422);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the public portal can decline a sent quote",
    async () => {
      const createRes = await request(app)
        .post("/v1/quotes")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({
          clientId,
          validUntil: "2026-12-31",
          lineItems: [{ description: "Wardrobe", quantity: 1, unitPrice: 90_000 }],
        });
      const quoteId = createRes.body.data.id;

      const sendRes = await request(app)
        .post(`/v1/quotes/${quoteId}/send`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      const portalToken = sendRes.body.data.portalToken;

      const declineRes = await request(app)
        .post(`/v1/quote-portal/${portalToken}/decline`)
        .send({ reason: "Found a cheaper supplier" });
      expect(declineRes.status).toBe(200);
      expect(declineRes.body.data.status).toBe("declined");

      // A declined quote can never be converted.
      const convertRes = await request(app)
        .post(`/v1/quotes/${quoteId}/convert-to-invoice`)
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(convertRes.status).toBe(422);
    },
    TEST_TIMEOUT_MS,
  );
});
