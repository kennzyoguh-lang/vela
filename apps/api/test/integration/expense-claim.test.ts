// Expense claims — proves the real HTTP/DB round trip: a staff member
// submits their own claim with an attached receipt, an owner sees it in
// the org-wide listing (with the submitter's name resolved), a staff
// member cannot approve/reject anyone's claim (including their own), an
// owner can approve one, and a second review attempt on the same claim is
// rejected.
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Express } from "express";

const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;
const ACCOUNT_SECRET = "correct-horse-battery-staple";

describe("Expense claims (real DB, real HTTP layer)", () => {
  let app: Express;
  let ownerToken: string;
  let staffToken: string;
  let staffName: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();

    const email = `expense-owner-${randomUUID()}@example.com`;
    const signupRes = await request(app).post("/v1/auth/signup").send({
      orgName: "Expense Claim Test Org",
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
    staffName = "Chidinma";
    await withOrgScope(orgId, (tx) =>
      tx.user.create({
        data: {
          id: staffUserId,
          orgId,
          name: staffName,
          email: `expense-staff-${orgId}@example.com`,
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
    "a staff member submits a claim with a receipt, the owner sees it with the submitter's name, approves it, and a second review is rejected",
    async () => {
      const scanRes = await request(app)
        .post("/v1/receipts/scan")
        .set("Authorization", `Bearer ${staffToken}`)
        .attach("receipt", Buffer.from("fake receipt bytes"), {
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        });
      expect(scanRes.status).toBe(201);
      const receiptFileId = scanRes.body.data.storedFileId;

      const submitRes = await request(app)
        .post("/v1/expense-claims")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          category: "transport",
          vendor: "Uber",
          amount: 4500,
          expenseDate: "2026-08-10",
          receiptFileId,
        });
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data.status).toBe("pending");
      const claimId = submitRes.body.data.id;

      // Staff sees only their own claim, with no submittedByUser field.
      const staffListRes = await request(app)
        .get("/v1/expense-claims")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(staffListRes.status).toBe(200);
      expect(staffListRes.body.data.items).toHaveLength(1);
      expect(staffListRes.body.data.items[0].submittedByUser).toBeUndefined();

      // Owner sees the org-wide listing, with the submitter's name resolved.
      const ownerListRes = await request(app)
        .get("/v1/expense-claims")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownerListRes.status).toBe(200);
      const listedClaim = ownerListRes.body.data.items.find(
        (c: { id: string }) => c.id === claimId,
      );
      expect(listedClaim.submittedByUser).toEqual({ name: staffName });

      // Staff cannot approve/reject anyone's claim.
      const staffApproveRes = await request(app)
        .post(`/v1/expense-claims/${claimId}/approve`)
        .set("Authorization", `Bearer ${staffToken}`);
      expect(staffApproveRes.status).toBe(403);

      const ownerApproveRes = await request(app)
        .post(`/v1/expense-claims/${claimId}/approve`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownerApproveRes.status).toBe(200);
      expect(ownerApproveRes.body.data.status).toBe("approved");

      const secondReviewRes = await request(app)
        .post(`/v1/expense-claims/${claimId}/reject`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ reason: "too late" });
      expect(secondReviewRes.status).toBe(422);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a claim submitted with a non-expense category",
    async () => {
      const res = await request(app)
        .post("/v1/expense-claims")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          category: "income",
          vendor: "Someone",
          amount: 1000,
          expenseDate: "2026-08-10",
        });
      expect(res.status).toBe(400);
    },
    TEST_TIMEOUT_MS,
  );
});
