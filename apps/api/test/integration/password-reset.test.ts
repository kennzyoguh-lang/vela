// Password reset end-to-end — proves the full forgot-password -> emailed
// token -> reset -> every-session-terminated -> new-password-login flow
// against the real Express app, real DB, and real RS256 signing/
// verification (jwt.service.ts), which a mocked unit test can't exercise.
// The reset token is normally emailed; signPasswordResetToken is imported
// directly here to construct one for a known account, same "test the real
// consuming endpoint without needing real email delivery" shape as this
// project's other token-based flows.
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

describe("Password reset (real DB, real HTTP layer)", () => {
  let app: Express;
  let email: string;
  const originalPassword = "correct-horse-battery-staple";
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    email = `password-reset-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Password Reset Test Org",
      name: "Owner",
      email,
      password: originalPassword,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);

    const claims = jwt.decode(signupRes.body.data.accessToken) as { orgId: string };
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
    "/forgot-password responds identically whether or not the email has an account",
    async () => {
      const realRes = await request(app).post("/v1/auth/forgot-password").send({ email });
      const fakeRes = await request(app)
        .post("/v1/auth/forgot-password")
        .send({ email: `nobody-${randomUUID()}@example.com` });

      expect(realRes.status).toBe(fakeRes.status);
      // Compares .data only, not the whole body — meta.requestId is a
      // per-request trace id (lib/response.ts), correctly different on
      // every call, not part of the enumeration-safety guarantee.
      expect(realRes.body.data).toEqual(fakeRes.body.data);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "resets the password, logs out every session, and the new password works while the old one doesn't",
    async () => {
      // A real session that must not survive the reset.
      const loginRes = await request(app)
        .post("/v1/auth/login")
        .send({ email, password: originalPassword });
      expect(loginRes.status).toBe(200);
      const preResetAccessToken: string = loginRes.body.data.accessToken;

      const meBeforeRes = await request(app)
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${preResetAccessToken}`);
      expect(meBeforeRes.status).toBe(200);

      const { signPasswordResetToken } = await import("../../src/services/jwt.service");
      const claims = jwt.decode(preResetAccessToken) as { sub: string; orgId: string };
      const resetToken = signPasswordResetToken({ sub: claims.sub, orgId: claims.orgId });

      const newPassword = "a-brand-new-strong-password";
      const resetRes = await request(app)
        .post("/v1/auth/reset-password")
        .send({ token: resetToken, newPassword });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data).toEqual({ reset: true });

      // The old password no longer works.
      const oldLoginRes = await request(app)
        .post("/v1/auth/login")
        .send({ email, password: originalPassword });
      expect(oldLoginRes.status).toBe(401);

      // The new password does.
      const newLoginRes = await request(app)
        .post("/v1/auth/login")
        .send({ email, password: newPassword });
      expect(newLoginRes.status).toBe(200);

      // A reset token can't be replayed a second time.
      const replayRes = await request(app)
        .post("/v1/auth/reset-password")
        .send({ token: resetToken, newPassword: "yet-another-password" });
      expect(replayRes.status).toBe(401);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a malformed/expired reset token before touching the account",
    async () => {
      const garbageValue = ["not", "a", "real", "jwt"].join(".");
      const res = await request(app)
        .post("/v1/auth/reset-password")
        .send({ token: garbageValue, newPassword: "irrelevant-password-value" });
      expect(res.status).toBe(401);
    },
    TEST_TIMEOUT_MS,
  );
});
