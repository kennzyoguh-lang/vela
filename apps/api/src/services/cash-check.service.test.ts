import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/cash-check.repository", () => ({
  sumCompletedSalesTotal: vi.fn(),
  findByOrgAndDate: vi.fn(),
  create: vi.fn(),
  listByOrg: vi.fn(),
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

import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as smsGateway from "./sms/termii.gateway";
import * as emailGateway from "./email/email.gateway";
import * as businessProfileService from "./business-profile.service";
import * as cashCheckService from "./cash-check.service";

const UNSURE_FACTORS = {
  customerPattern: "unsure" as const,
  hasSalesStaff: "unsure" as const,
  isCacRegistered: "unsure" as const,
  moduleOverrides: {},
  profileFactorsConfirmedAt: null,
};

describe("cash-check.service#businessDayRange (WAT, UTC+1)", () => {
  it("keeps a UTC evening instant within the same WAT business day", () => {
    // 2026-07-31T22:30:00Z is 2026-07-31 23:30 WAT — still the same WAT day.
    const { start, end, businessDate } = cashCheckService.businessDayRange(
      new Date("2026-07-31T22:30:00Z"),
    );
    expect(start.toISOString()).toBe("2026-07-30T23:00:00.000Z"); // 2026-07-31 00:00 WAT
    expect(end.toISOString()).toBe("2026-07-31T23:00:00.000Z"); // 2026-08-01 00:00 WAT
    expect(businessDate.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("rolls over to the next WAT business day before UTC midnight", () => {
    // 2026-07-31T23:30:00Z is 2026-08-01 00:30 WAT — already the next WAT day,
    // even though it's still 2026-07-31 in plain UTC.
    const { start, end, businessDate } = cashCheckService.businessDayRange(
      new Date("2026-07-31T23:30:00Z"),
    );
    expect(start.toISOString()).toBe("2026-07-31T23:00:00.000Z"); // 2026-08-01 00:00 WAT
    expect(end.toISOString()).toBe("2026-08-01T23:00:00.000Z");
    expect(businessDate.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("cash-check.service#getExpectedForToday", () => {
  const orgId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("reports checked: false when no cash check has been submitted for today's business day", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue(null);

    const result = await cashCheckService.getExpectedForToday(orgId, new Date());

    expect(result.expectedAmount).toBe(15000);
    expect(result.checked).toBe(false);
  });

  it("reports checked: true once a cash check exists for today's business day", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(cashCheckRepo.findByOrgAndDate).mockResolvedValue({ id: randomUUID() } as never);

    const result = await cashCheckService.getExpectedForToday(orgId, new Date());

    expect(result.checked).toBe(true);
  });
});

describe("cash-check.service#submitCashCheck", () => {
  const orgId = randomUUID();
  const staffUserId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashCheckRepo.create).mockImplementation(
      async (_orgId, input) =>
        ({
          id: randomUUID(),
          orgId: _orgId,
          ...input,
        }) as never,
    );
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([]);
    vi.mocked(smsGateway.sendSms).mockResolvedValue(undefined);
    vi.mocked(emailGateway.sendEmail).mockResolvedValue(undefined);
    vi.mocked(businessProfileService.getBusinessProfile).mockResolvedValue(UNSURE_FACTORS as never);
  });

  it("matches when the counted amount equals the expected total and audit-logs the match", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);

    const record = await cashCheckService.submitCashCheck(orgId, staffUserId, 15000);

    expect(record).toMatchObject({
      expectedAmount: 15000,
      countedAmount: 15000,
      difference: 0,
      matched: true,
    });
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ orgId, userId: staffUserId, action: "cash_check.matched" }),
    );
  });

  it("flags a mismatch with the signed difference and audit-logs it distinctly", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);

    const record = await cashCheckService.submitCashCheck(orgId, staffUserId, 12000);

    expect(record).toMatchObject({
      expectedAmount: 15000,
      countedAmount: 12000,
      difference: -3000,
      matched: false,
    });
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: staffUserId,
        action: "cash_check.mismatched",
        newValue: { expectedAmount: 15000, countedAmount: 12000, difference: -3000 },
      }),
    );
  });

  it("treats sub-kobo floating point drift as a match rather than a false mismatch", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(0.1 + 0.2); // 0.30000000000000004

    const record = await cashCheckService.submitCashCheck(orgId, staffUserId, 0.3);

    expect(record).toMatchObject({ difference: 0, matched: true });
  });

  it("sends an SMS to every owner/admin notification phone on a mismatch (informal org)", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: "owner1@example.com" },
      { phone: "+2348022222222", email: null },
    ]);

    await cashCheckService.submitCashCheck(orgId, staffUserId, 12000);

    expect(smsGateway.sendSms).toHaveBeenCalledTimes(2);
    expect(smsGateway.sendSms).toHaveBeenCalledWith(
      "+2348011111111",
      expect.stringContaining("₦3,000 short"),
    );
    expect(smsGateway.sendSms).toHaveBeenCalledWith(
      "+2348022222222",
      expect.stringContaining("₦3,000 short"),
    );
    expect(emailGateway.sendEmail).not.toHaveBeenCalled();
  });

  it("sends an email to every owner/admin on a mismatch for a CAC-registered org", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(businessProfileService.getBusinessProfile).mockResolvedValue({
      ...UNSURE_FACTORS,
      isCacRegistered: "yes",
    } as never);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: "owner1@example.com" },
    ]);

    await cashCheckService.submitCashCheck(orgId, staffUserId, 12000);

    expect(emailGateway.sendEmail).toHaveBeenCalledWith(
      "owner1@example.com",
      "VELA cash check mismatch",
      expect.stringContaining("₦3,000 short"),
    );
    expect(smsGateway.sendSms).not.toHaveBeenCalled();
  });

  it("does not send any SMS on a match", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: null },
    ]);

    await cashCheckService.submitCashCheck(orgId, staffUserId, 15000);

    expect(smsGateway.sendSms).not.toHaveBeenCalled();
  });

  it("still succeeds and returns the record even when every SMS send fails", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: null },
    ]);
    vi.mocked(smsGateway.sendSms).mockRejectedValue(new Error("Termii is down"));

    const record = await cashCheckService.submitCashCheck(orgId, staffUserId, 12000);

    expect(record.matched).toBe(false);
  });
});
