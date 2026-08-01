import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/sale.repository", () => ({
  getDailyStats: vi.fn(),
}));
vi.mock("../repositories/cash-check.repository", () => ({
  findByOrgAndDate: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  findNotifiablePhones: vi.fn(),
  findNotifiableRecipients: vi.fn(),
}));
vi.mock("./sms/termii.gateway", () => ({
  sendSms: vi.fn(),
}));
vi.mock("./email/email.gateway", () => ({
  sendEmail: vi.fn(),
}));
vi.mock("./business-profile.service", () => ({
  getBusinessProfile: vi.fn(),
}));

import * as saleRepo from "../repositories/sale.repository";
import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as smsGateway from "./sms/termii.gateway";
import * as emailGateway from "./email/email.gateway";
import * as businessProfileService from "./business-profile.service";
import * as ownerSummaryService from "./owner-summary.service";

const UNSURE_FACTORS = {
  customerPattern: "unsure" as const,
  hasSalesStaff: "unsure" as const,
  isCacRegistered: "unsure" as const,
  moduleOverrides: {},
  profileFactorsConfirmedAt: null,
};

describe("owner-summary.service#getTodaySummary", () => {
  const orgId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("is 'pending' when no cash check has been submitted yet today", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 42, total: 185_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);

    const summary = await ownerSummaryService.getTodaySummary(orgId, new Date());

    expect(summary).toEqual({
      salesCount: 42,
      expectedAmount: 185_000,
      countedAmount: null,
      difference: null,
      status: "pending",
    });
  });

  it("is 'matched' when the submitted cash check has zero difference", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 42, total: 185_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue({
      countedAmount: 185_000,
      difference: 0,
    } as never);

    const summary = await ownerSummaryService.getTodaySummary(orgId, new Date());

    expect(summary.status).toBe("matched");
    expect(summary.countedAmount).toBe(185_000);
  });

  it("is 'shortfall' when counted is less than expected", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 42, total: 185_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue({
      countedAmount: 180_000,
      difference: -5_000,
    } as never);

    const summary = await ownerSummaryService.getTodaySummary(orgId, new Date());

    expect(summary.status).toBe("shortfall");
    expect(summary.difference).toBe(-5_000);
  });

  it("is 'overage' when counted is more than expected", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 42, total: 185_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue({
      countedAmount: 190_000,
      difference: 5_000,
    } as never);

    const summary = await ownerSummaryService.getTodaySummary(orgId, new Date());

    expect(summary.status).toBe("overage");
  });
});

describe("owner-summary.service#composeSummaryMessage", () => {
  it("matches the spec's exact plain-language shape for a shortfall", () => {
    const message = ownerSummaryService.composeSummaryMessage({
      salesCount: 42,
      expectedAmount: 185_000,
      countedAmount: 180_000,
      difference: -5_000,
      status: "shortfall",
    });

    expect(message).toBe(
      "Today: 42 sales, ₦185,000 expected cash, ₦180,000 counted. ₦5,000 short.",
    );
  });

  it("says 'over' rather than 'short' for an overage", () => {
    const message = ownerSummaryService.composeSummaryMessage({
      salesCount: 42,
      expectedAmount: 185_000,
      countedAmount: 190_000,
      difference: 5_000,
      status: "overage",
    });

    expect(message).toBe("Today: 42 sales, ₦185,000 expected cash, ₦190,000 counted. ₦5,000 over.");
  });

  it("reads cleanly for a single sale (no dangling plural)", () => {
    const message = ownerSummaryService.composeSummaryMessage({
      salesCount: 1,
      expectedAmount: 1_500,
      countedAmount: 1_500,
      difference: 0,
      status: "matched",
    });

    expect(message).toBe("Today: 1 sale, ₦1,500 expected cash, ₦1,500 counted. All matched.");
  });

  it("has no jargon and no cash figures when no count has happened yet", () => {
    const message = ownerSummaryService.composeSummaryMessage({
      salesCount: 42,
      expectedAmount: 185_000,
      countedAmount: null,
      difference: null,
      status: "pending",
    });

    expect(message).toBe("Today: 42 sales, ₦185,000 expected cash. No cash count yet.");
  });
});

describe("owner-summary.service#sendDailySummary", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([]);
    vi.mocked(smsGateway.sendSms).mockResolvedValue(undefined);
    vi.mocked(emailGateway.sendEmail).mockResolvedValue(undefined);
    vi.mocked(businessProfileService.getBusinessProfile).mockResolvedValue(UNSURE_FACTORS as never);
  });

  it("audit-logs the composed message, status, and channel", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 5, total: 10_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);

    await ownerSummaryService.sendDailySummary(orgId, new Date());

    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        action: "owner_summary.sent",
        entityType: "organisation",
        entityId: orgId,
        newValue: expect.objectContaining({ status: "pending", channel: "whatsapp_sms" }),
      }),
    );
  });

  it("sends the composed message via SMS for an informal (all-unsure) org", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 5, total: 10_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: "owner1@example.com" },
      { phone: "+2348022222222", email: null },
    ]);

    await ownerSummaryService.sendDailySummary(orgId, new Date());

    expect(smsGateway.sendSms).toHaveBeenCalledTimes(2);
    expect(smsGateway.sendSms).toHaveBeenCalledWith(
      "+2348011111111",
      expect.stringContaining("No cash count yet"),
    );
    expect(emailGateway.sendEmail).not.toHaveBeenCalled();
  });

  it("sends the composed message via email for a CAC-registered org", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 5, total: 10_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);
    vi.mocked(businessProfileService.getBusinessProfile).mockResolvedValue({
      ...UNSURE_FACTORS,
      isCacRegistered: "yes",
    } as never);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: "owner1@example.com" },
      { phone: null, email: "owner2@example.com" },
    ]);

    await ownerSummaryService.sendDailySummary(orgId, new Date());

    expect(emailGateway.sendEmail).toHaveBeenCalledTimes(2);
    expect(emailGateway.sendEmail).toHaveBeenCalledWith(
      "owner1@example.com",
      "Your VELA daily summary",
      expect.stringContaining("No cash count yet"),
    );
    expect(smsGateway.sendSms).not.toHaveBeenCalled();
  });

  it("still audit-logs even when no notification phone is configured", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 5, total: 10_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);

    await ownerSummaryService.sendDailySummary(orgId, new Date());

    expect(smsGateway.sendSms).not.toHaveBeenCalled();
    expect(auditLogRepo.write).toHaveBeenCalled();
  });

  it("still audit-logs even when every SMS send fails", async () => {
    vi.mocked(saleRepo.getDailyStats).mockResolvedValue({ count: 5, total: 10_000 });
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: null },
    ]);
    vi.mocked(smsGateway.sendSms).mockRejectedValue(new Error("Termii is down"));

    await expect(ownerSummaryService.sendDailySummary(orgId, new Date())).resolves.toBeUndefined();
    expect(auditLogRepo.write).toHaveBeenCalled();
  });
});
