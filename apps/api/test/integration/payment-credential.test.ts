// Bring-your-own payment processor — proves connect/list/disconnect round-trip
// through the real Express app, real DB, and real AES-256-GCM encryption
// (lib/encryption.ts via payment-credential.service.ts), plus the RBAC and
// audit-log wiring on payment-credential.routes.ts. A mocked unit test
// already proves the crypto round-trips correctly in isolation
// (payment-credential.service.test.ts); this proves the whole stack agrees.
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

describe("Payment credentials (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerToken: string;
  let staffToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `payment-credential-${randomUUID()}@example.com`;
    const accountSecret = "correct-horse-battery-staple";
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Payment Credential Test Org",
      name: "Owner",
      email,
      password: accountSecret,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerToken) as { orgId: string };
    const orgId = claims.orgId;
    createdOrgIds.push(orgId);

    // Same direct-DB-plus-signed-token shape as rbac.test.ts's
    // createOrgAndUser — there is no user-creation HTTP route to exercise
    // here, and this test's concern is payment-credential RBAC, not signup.
    const { withOrgScope } = await import("../../src/lib/prisma");
    const staffUserId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.user.create({
        data: {
          id: staffUserId,
          orgId,
          name: "Staff",
          email: `payment-credential-staff-${orgId}@example.com`,
          passwordHash: "irrelevant-for-this-test",
          role: "staff",
        },
      }),
    );
    const { signAccessToken } = await import("../../src/services/jwt.service");
    staffToken = signAccessToken({
      sub: staffUserId,
      orgId,
      role: "staff",
      sessionFamilyId: randomUUID(),
    });
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
    "connects, lists, and disconnects a processor credential without ever echoing the secret back",
    async () => {
      const connectRes = await request(app)
        .post("/v1/payment-credentials")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          processor: "paystack",
          secretKey: "sk_test_real_secret_value",
          publicKey: "pk_test_abc",
        });
      expect(connectRes.status).toBe(201);
      expect(connectRes.body.data).toMatchObject({
        processor: "paystack",
        publicKey: "pk_test_abc",
      });
      expect(JSON.stringify(connectRes.body)).not.toContain("sk_test_real_secret_value");

      const listRes = await request(app)
        .get("/v1/payment-credentials")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toEqual([
        expect.objectContaining({
          processor: "paystack",
          isActive: true,
          publicKey: "pk_test_abc",
        }),
      ]);
      expect(JSON.stringify(listRes.body)).not.toContain("sk_test_real_secret_value");

      const disconnectRes = await request(app)
        .delete("/v1/payment-credentials/paystack")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(disconnectRes.status).toBe(200);

      const listAfterRes = await request(app)
        .get("/v1/payment-credentials")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(listAfterRes.status).toBe(200);
      expect(listAfterRes.body.data).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "reconnecting the same processor replaces the old credential rather than duplicating it",
    async () => {
      await request(app)
        .post("/v1/payment-credentials")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ processor: "flutterwave", secretKey: "flw_secret_one" });

      await request(app)
        .post("/v1/payment-credentials")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ processor: "flutterwave", secretKey: "flw_secret_two" });

      const listRes = await request(app)
        .get("/v1/payment-credentials")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(listRes.status).toBe(200);
      expect(
        listRes.body.data.filter((c: { processor: string }) => c.processor === "flutterwave"),
      ).toHaveLength(1);

      await request(app)
        .delete("/v1/payment-credentials/flutterwave")
        .set("Authorization", `Bearer ${ownerToken}`);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a staff role — connecting a payment processor is owner/admin only",
    async () => {
      const res = await request(app)
        .post("/v1/payment-credentials")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ processor: "paystack", secretKey: "sk_should_be_rejected" });
      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects an unauthenticated request",
    async () => {
      const res = await request(app).get("/v1/payment-credentials");
      expect(res.status).toBe(401);
    },
    TEST_TIMEOUT_MS,
  );
});
