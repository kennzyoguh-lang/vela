// Security review finding: 2FA never actually gated login — a full access
// token and refresh cookie were issued unconditionally regardless of
// requiresTwoFa. This exercises the real fix end-to-end through the actual
// Express app (supertest), not just the service layer: a fresh login pauses
// on a challenge (no session yet), and only a correct code (TOTP or backup)
// completes it. The signup+2FA-enrollment fixture is set up once in
// beforeAll and reused across assertions — each assertion still gets its own
// fresh login() call (a new challenge token), but doesn't re-pay the cost of
// a full signup + 8-backup-code-hash enrollment (bcrypt cost 12, real
// Supabase round-trips) five times over.
import request from "supertest";
import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
// Each assertion still makes 1-2 real HTTP round-trips, and a Redis-
// unreachable environment adds a couple of seconds of retry/fail-open delay
// on top per call (rate limiting + the 2FA lockout check) — comfortably
// past the default 15s under that combination.
const TEST_TIMEOUT_MS = 30_000;

describe("2FA login flow (real DB, real HTTP layer)", () => {
  let app: Express;
  let email: string;
  let password: string;
  let secret: string;
  let backupCodes: string[];
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();
    email = `2fa-${randomUUID()}@example.com`;
    password = "correct-horse-battery-staple";

    const signupRes = await request(app)
      .post("/v1/auth/signup")
      .send({ orgName: "2FA Test Org", name: "Owner", email, password, country: "NG" });
    expect(signupRes.status).toBe(201);
    const accessToken: string = signupRes.body.data.accessToken;

    const setupRes = await request(app)
      .post("/v1/auth/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email });
    expect(setupRes.status).toBe(200);
    secret = setupRes.body.data.secret;

    const setupCode = authenticator.generate(secret);
    const confirmRes = await request(app)
      .post("/v1/auth/2fa/confirm")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ secret, code: setupCode });
    expect(confirmRes.status).toBe(201);
    backupCodes = confirmRes.body.data.backupCodes;

    // Decoded (not verified) purely for cleanup bookkeeping — querying
    // `users` directly here would go through the unscoped module-level
    // `prisma` client with no app.current_org_id set, which RLS's
    // org_isolation_select policy can't evaluate (empty-string-to-uuid cast
    // error), unlike `withOrgScope`-wrapped application code.
    const claims = jwt.decode(accessToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  async function login(): Promise<string> {
    const loginRes = await request(app).post("/v1/auth/login").send({ email, password });
    expect(loginRes.status).toBe(200);
    return loginRes.body.data.challengeToken;
  }

  it(
    "a fresh login pauses on a 2FA challenge — no session is issued yet",
    async () => {
      const loginRes = await request(app).post("/v1/auth/login").send({ email, password });

      expect(loginRes.body.data.requiresTwoFa).toBe(true);
      expect(loginRes.body.data.challengeToken).toBeDefined();
      expect(loginRes.body.data.accessToken).toBeUndefined();
      expect(loginRes.headers["set-cookie"]).toBeUndefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a correct TOTP code completes the challenge and issues a real session",
    async () => {
      const challengeToken = await login();
      const code = authenticator.generate(secret);

      const verifyRes = await request(app)
        .post("/v1/auth/2fa/verify")
        .send({ challengeToken, code });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.accessToken).toBeDefined();
      expect(verifyRes.headers["set-cookie"]).toBeDefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a correct backup code also completes the challenge",
    async () => {
      const challengeToken = await login();

      const verifyRes = await request(app)
        .post("/v1/auth/2fa/verify")
        .send({ challengeToken, code: backupCodes[0] });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.accessToken).toBeDefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a wrong code is rejected and issues no session",
    async () => {
      const challengeToken = await login();

      const verifyRes = await request(app)
        .post("/v1/auth/2fa/verify")
        .send({ challengeToken, code: "000000" });

      expect(verifyRes.status).toBe(401);
      expect(verifyRes.headers["set-cookie"]).toBeUndefined();
    },
    TEST_TIMEOUT_MS,
  );

  // The 5-attempt lockout itself (isTwoFaLockedOut/recordTwoFaFailure,
  // rate-limit.service.ts) is thoroughly covered by auth.service.test.ts's
  // mocked "rejects immediately when locked out" case — not repeated here
  // against real Redis, since this dev environment has no local Redis
  // reachable and the functions now deliberately fail OPEN on a Redis error
  // (same contract as checkAndIncrement) rather than hang or 500 every
  // legitimate user out during an outage.

  it(
    "a challenge token can never be used as a real access token against a protected route",
    async () => {
      const challengeToken = await login();

      const res = await request(app)
        .get("/v1/invoices")
        .set("Authorization", `Bearer ${challengeToken}`);

      expect(res.status).toBe(401);
    },
    TEST_TIMEOUT_MS,
  );
});
