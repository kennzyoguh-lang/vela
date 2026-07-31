// Anti-theft/POS feature: phone+PIN staff login, alongside the existing
// email+password(+2FA) path. Exercises the real fix end-to-end through the
// actual Express app (supertest), not just the service layer — trust-on-
// first-use device binding, a wrong PIN, and a device mismatch after
// binding all need to be proven against the real DB, since the unique
// constraint / RLS / SECURITY DEFINER lookup function are all real
// database behavior a mocked unit test can't exercise.
//
// Deliberately no beforeAll setting DATABASE_URL/APP_DATABASE_URL fallbacks
// here (unlike the mocked unit tests) — this is a real-DB integration test,
// and Prisma's own .env loading needs to populate the real Supabase
// credentials; pre-setting a placeholder via `??=` would win the race and
// silently point this test at a nonexistent local database instead.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

describe("Phone+PIN staff login (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  let staffPhone: string;
  const staffPin = "1234";
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `pos-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "POS Test Org",
      name: "Owner",
      email,
      password: "correct-horse-battery-staple",
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerAccessToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerAccessToken) as { orgId: string };
    createdOrgIds.push(claims.orgId);

    // Unique phone per test run — a random 8-digit Nigerian-format local
    // number, distinct from any other run's, avoiding a stale unique-
    // constraint collision across repeated test executions.
    staffPhone = `080${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
    const createStaffRes = await request(app)
      .post("/v1/organisation/staff")
      .set("Authorization", `Bearer ${ownerAccessToken}`)
      .send({ name: "Amaka", phone: staffPhone, role: "staff", pin: staffPin });
    expect(createStaffRes.status).toBe(201);
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.organisation.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  it(
    "a correct phone+PIN from a fresh device succeeds and binds that device",
    async () => {
      const res = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: staffPin, deviceId: "device-a" });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the same phone+PIN from the same (now-bound) device succeeds again",
    async () => {
      const res = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: staffPin, deviceId: "device-a" });

      expect(res.status).toBe(200);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the same phone+PIN from a DIFFERENT device is rejected after binding",
    async () => {
      const res = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: staffPin, deviceId: "device-b" });

      expect(res.status).toBe(401);
      expect(res.headers["set-cookie"]).toBeUndefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a wrong PIN is rejected and issues no session",
    async () => {
      const res = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: "0000", deviceId: "device-a" });

      expect(res.status).toBe(401);
      expect(res.headers["set-cookie"]).toBeUndefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "an unknown phone number is rejected with the same status as a wrong PIN",
    async () => {
      const res = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: "08000000000", pin: "1234", deviceId: "device-a" });

      expect(res.status).toBe(401);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a staff session cannot reach an owner-only route",
    async () => {
      const loginRes = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone: staffPhone, pin: staffPin, deviceId: "device-a" });
      const staffAccessToken: string = loginRes.body.data.accessToken;

      const res = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ name: "Someone Else", phone: "08011112222", role: "staff", pin: "5678" });

      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT_MS,
  );
});
