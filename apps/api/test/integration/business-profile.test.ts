// Business profiling — real DB, real HTTP layer. Proves: default state
// before onboarding, owner/admin can set factors and module overrides,
// staff can READ the profile (module visibility affects their own UI too)
// but cannot mutate it, and clearing an override reverts to the computed
// default.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

describe("Business profile (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerAccessToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `business-profile-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Business Profile Test Org",
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
    "defaults every factor to unsure and profileFactorsConfirmedAt to null before onboarding",
    async () => {
      const res = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        customerPattern: "unsure",
        hasSalesStaff: "unsure",
        isCacRegistered: "unsure",
        moduleOverrides: {},
        profileFactorsConfirmedAt: null,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "owner can set the three factors, and GET reflects the change with a non-null confirmedAt",
    async () => {
      const setRes = await request(app)
        .patch("/v1/organisation/business-profile/factors")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ customerPattern: "one_time", hasSalesStaff: "yes", isCacRegistered: "no" });
      expect(setRes.status).toBe(200);

      const getRes = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${ownerAccessToken}`);

      expect(getRes.body.data.customerPattern).toBe("one_time");
      expect(getRes.body.data.hasSalesStaff).toBe("yes");
      expect(getRes.body.data.isCacRegistered).toBe("no");
      expect(getRes.body.data.profileFactorsConfirmedAt).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "owner can set and then clear a module override",
    async () => {
      const revealRes = await request(app)
        .patch("/v1/organisation/business-profile/module-override")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ moduleKey: "compliance", value: true });
      expect(revealRes.status).toBe(200);

      const afterReveal = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(afterReveal.body.data.moduleOverrides).toMatchObject({ compliance: true });

      const clearRes = await request(app)
        .patch("/v1/organisation/business-profile/module-override")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ moduleKey: "compliance", value: null });
      expect(clearRes.status).toBe(200);

      const afterClear = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${ownerAccessToken}`);
      expect(afterClear.body.data.moduleOverrides).not.toHaveProperty("compliance");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "staff can read the profile but cannot set factors or overrides",
    async () => {
      const phone = `080${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
      const createStaffRes = await request(app)
        .post("/v1/organisation/staff")
        .set("Authorization", `Bearer ${ownerAccessToken}`)
        .send({ name: "Amaka", phone, role: "staff", pin: "1234" });
      expect(createStaffRes.status).toBe(201);

      const staffLoginRes = await request(app)
        .post("/v1/auth/staff/login")
        .send({ phone, pin: "1234", deviceId: "device-business-profile-test" });
      expect(staffLoginRes.status).toBe(200);
      const staffAccessToken = staffLoginRes.body.data.accessToken;

      const getRes = await request(app)
        .get("/v1/organisation/business-profile")
        .set("Authorization", `Bearer ${staffAccessToken}`);
      expect(getRes.status).toBe(200);

      const setFactorsRes = await request(app)
        .patch("/v1/organisation/business-profile/factors")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ customerPattern: "repeat", hasSalesStaff: "yes", isCacRegistered: "yes" });
      expect(setFactorsRes.status).toBe(403);

      const setOverrideRes = await request(app)
        .patch("/v1/organisation/business-profile/module-override")
        .set("Authorization", `Bearer ${staffAccessToken}`)
        .send({ moduleKey: "compliance", value: true });
      expect(setOverrideRes.status).toBe(403);
    },
    SETUP_TIMEOUT_MS,
  );
});
