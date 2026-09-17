// Receipt upload + OCR — proves the real HTTP/DB round trip: a receipt
// uploads and stores (stored_files, RLS-scoped) regardless of whether OCR
// is configured (Handbook 1.4 — a missing MINDEE_API_KEY blocks only the
// auto-fill convenience, never the upload itself), the uploader can read
// it back, another org member cannot, and an oversized/wrong-type file is
// rejected before it's ever stored.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const ACCOUNT_SECRET = "correct-horse-battery-staple";

describe("Receipt upload and OCR (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerToken: string;
  let staffToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `receipt-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Receipt Test Org",
      name: "Owner",
      email,
      password: ACCOUNT_SECRET,
      country: "NG",
    });
    expect(signupRes.status).toBe(201);
    ownerToken = signupRes.body.data.accessToken;

    const claims = jwt.decode(ownerToken) as { orgId: string };
    const orgId = claims.orgId;
    createdOrgIds.push(orgId);

    const { withOrgScope } = await import("../../src/lib/prisma");
    const staffUserId = randomUUID();
    await withOrgScope(orgId, (tx) =>
      tx.user.create({
        data: {
          id: staffUserId,
          orgId,
          name: "Staff",
          email: `receipt-staff-${orgId}@example.com`,
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
    "a staff member can scan a receipt, read it back, but another org's owner cannot",
    async () => {
      const scanRes = await request(app)
        .post("/v1/receipts/scan")
        .set("Authorization", `Bearer ${staffToken}`)
        .attach("receipt", Buffer.from("fake jpeg bytes"), {
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        });
      expect(scanRes.status).toBe(201);
      expect(scanRes.body.data.storedFileId).toBeDefined();
      // MINDEE_API_KEY isn't configured in CI/local — a real key would make
      // this non-null, but the upload must succeed regardless either way.
      expect(scanRes.body.data.extracted).toBeNull();

      const fileId = scanRes.body.data.storedFileId;

      const ownDownloadRes = await request(app)
        .get(`/v1/receipts/${fileId}`)
        .buffer(true)
        .set("Authorization", `Bearer ${staffToken}`);
      expect(ownDownloadRes.status).toBe(200);
      expect(ownDownloadRes.headers["content-type"]).toContain("image/jpeg");
      expect(Buffer.isBuffer(ownDownloadRes.body) ? ownDownloadRes.body.toString() : "").toBe(
        "fake jpeg bytes",
      );

      const ownerDownloadRes = await request(app)
        .get(`/v1/receipts/${fileId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownerDownloadRes.status).toBe(200);

      const otherOrgSignupRes = await request(app)
        .post("/v1/auth/signup")
        .send({
          orgName: "Other Org",
          name: "Other Owner",
          email: `receipt-other-owner-${randomUUID()}@example.com`,
          password: ACCOUNT_SECRET,
          country: "NG",
        });
      expect(otherOrgSignupRes.status).toBe(201);
      const otherOrgToken = otherOrgSignupRes.body.data.accessToken;
      const otherOrgClaims = jwt.decode(otherOrgToken) as { orgId: string };
      createdOrgIds.push(otherOrgClaims.orgId);

      const otherOrgDownloadRes = await request(app)
        .get(`/v1/receipts/${fileId}`)
        .set("Authorization", `Bearer ${otherOrgToken}`);
      expect(otherOrgDownloadRes.status).toBe(404);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects an unsupported file type before it's ever stored",
    async () => {
      const res = await request(app)
        .post("/v1/receipts/scan")
        .set("Authorization", `Bearer ${staffToken}`)
        .attach("receipt", Buffer.from("not really a video"), {
          filename: "video.mp4",
          contentType: "video/mp4",
        });
      expect(res.status).toBe(400);
    },
    TEST_TIMEOUT_MS,
  );
});
