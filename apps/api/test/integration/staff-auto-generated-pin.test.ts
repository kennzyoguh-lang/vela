// Anti-theft/POS feature, Piece 5: the visual "Add Sales Staff" flow never
// collects a PIN — organisation.service.ts#createStaffUser generates one and
// returns it once. Real DB, real HTTP layer — proves the generated PIN is
// exactly what unlocks staff login, not a placeholder that happens to look
// right in the response.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

describe("Auto-generated staff PIN (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `staff-auto-pin-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Staff Auto Pin Test Org",
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
    "creating staff with no pin returns a 4-digit generatedPin that logs them in",
    async () => {
      const phone = `081${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const createRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Chidinma", phone, role: "staff" }); // no pin field at all

      expect(createRes.status).toBe(201);
      const generatedPin: string = createRes.body.data.generatedPin;
      expect(generatedPin).toMatch(/^\d{4}$/);

      const loginRes = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone, pin: generatedPin, deviceId: "device-a" });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.accessToken).toBeDefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "creating staff WITH a pin returns no generatedPin",
    async () => {
      const phone = `081${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const createRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Emeka", phone, role: "staff", pin: "4321" });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.generatedPin).toBeUndefined();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the Manager role card maps to the admin role",
    async () => {
      const phone = `081${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const createRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Ngozi", phone, role: "admin" });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.role).toBe("admin");
    },
    TEST_TIMEOUT_MS,
  );
});
