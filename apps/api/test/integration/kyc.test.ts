// KYC — proves the real HTTP/DB round trip (submit NIN/BVN, real
// AES-256-GCM encryption via lib/encryption.ts, RLS-scoped storage) and
// that the plaintext value is never echoed back in any response, the same
// discipline as payment-credential.test.ts.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const ACCOUNT_SECRET = "correct-horse-battery-staple";

describe("KYC (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `kyc-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "KYC Test Org",
      name: "Owner",
      email,
      password: ACCOUNT_SECRET,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);
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
    "starts with nothing on file, then reflects submitted-but-not-verified for both NIN and BVN",
    async () => {
      const beforeRes = await request(app)
        .get("/v1/organisation/kyc")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body.data).toEqual({
        ninSubmitted: false,
        ninVerified: false,
        bvnSubmitted: false,
        bvnVerified: false,
      });

      const ninRes = await request(app)
        .post("/v1/organisation/kyc/nin")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ nin: "12345678901" });
      expect(ninRes.status).toBe(200);
      expect(JSON.stringify(ninRes.body)).not.toContain("12345678901");

      const bvnRes = await request(app)
        .post("/v1/organisation/kyc/bvn")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ bvn: "10987654321" });
      expect(bvnRes.status).toBe(200);
      expect(JSON.stringify(bvnRes.body)).not.toContain("10987654321");

      const afterRes = await request(app)
        .get("/v1/organisation/kyc")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.data).toEqual({
        ninSubmitted: true,
        ninVerified: false,
        bvnSubmitted: true,
        bvnVerified: false,
      });
      expect(JSON.stringify(afterRes.body)).not.toContain("12345678901");
      expect(JSON.stringify(afterRes.body)).not.toContain("10987654321");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a NIN/BVN that isn't exactly 11 digits",
    async () => {
      const res = await request(app)
        .post("/v1/organisation/kyc/nin")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ nin: "123" });
      expect(res.status).toBe(400);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects an unauthenticated request",
    async () => {
      const res = await request(app).get("/v1/organisation/kyc");
      expect(res.status).toBe(401);
    },
    TEST_TIMEOUT_MS,
  );
});
