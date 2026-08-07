import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/email/email.gateway", () => ({
  sendEmail: vi.fn(),
}));
// nurture-day7.ts (email/templates/) imports the real env module directly
// for WEB_APP_URL — stubbed here so this test never needs the full env.ts
// schema (DATABASE_URL etc.) satisfied.
vi.mock("../lib/env", () => ({
  env: { WEB_APP_URL: "http://localhost:3000" },
}));
vi.mock("./queue", () => ({
  NURTURE_EMAIL_QUEUE: "nurture-email",
  DEFAULT_JOB_OPTIONS: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
  nurtureEmailQueue: { add: vi.fn() },
  createWorker: vi.fn(),
}));

import * as emailGateway from "../services/email/email.gateway";
import { nurtureEmailQueue } from "./queue";
import { runNurtureEmailJob, scheduleNurtureEmails } from "./nurture-email.job";

describe("nurture-email.job#runNurtureEmailJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the day0 template for a tier_0 signup", async () => {
    await runNurtureEmailJob({
      signupId: "s1",
      email: "trader@example.com",
      ownerName: "Ada",
      segment: "tier_0",
      day: "day0",
    });

    expect(emailGateway.sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, text, html] = vi.mocked(emailGateway.sendEmail).mock.calls[0]!;
    expect(to).toBe("trader@example.com");
    expect(subject).toMatch(/till/i);
    expect(text).toContain("Ada");
    expect(html).toContain("Ada");
  });

  it("sends a different template per day and segment", async () => {
    await runNurtureEmailJob({
      signupId: "s1",
      email: "owner@example.com",
      ownerName: "Chidi",
      segment: "mid_market",
      day: "day7",
    });

    const [, subject, text] = vi.mocked(emailGateway.sendEmail).mock.calls[0]!;
    expect(subject).toMatch(/overdue/i);
    expect(text).toContain("signup"); // CTA link path
  });
});

describe("nurture-email.job#scheduleNurtureEmails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueues day0 immediately and day3/day7 as delayed jobs, each with a deterministic jobId", async () => {
    await scheduleNurtureEmails({
      id: "signup-1",
      email: "ada@example.com",
      ownerName: "Ada",
      segment: "tier_0",
    });

    expect(nurtureEmailQueue.add).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(nurtureEmailQueue.add).mock.calls;

    const day0 = calls.find((c) => (c[1] as { day: string }).day === "day0")!;
    expect((day0[2] as { delay: number }).delay).toBe(0);
    expect((day0[2] as { jobId: string }).jobId).toBe("nurture-signup-1-day0");

    const day3 = calls.find((c) => (c[1] as { day: string }).day === "day3")!;
    expect((day3[2] as { delay: number }).delay).toBe(3 * 24 * 60 * 60 * 1000);

    const day7 = calls.find((c) => (c[1] as { day: string }).day === "day7")!;
    expect((day7[2] as { delay: number }).delay).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
