import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/cash-check.repository", () => ({
  sumCompletedSalesTotal: vi.fn(),
  create: vi.fn(),
  listByOrg: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  findNotifiablePhones: vi.fn(),
}));
vi.mock("./sms/termii.gateway", () => ({
  sendSms: vi.fn(),
}));

import * as cashCheckRepo from "../repositories/cash-check.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as smsGateway from "./sms/termii.gateway";
import * as cashCheckService from "./cash-check.service";

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
    vi.mocked(userRepo.findNotifiablePhones).mockResolvedValue([]);
    vi.mocked(smsGateway.sendSms).mockResolvedValue(undefined);
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

  it("sends an SMS to every owner/admin notification phone on a mismatch", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(userRepo.findNotifiablePhones).mockResolvedValue([
      "+2348011111111",
      "+2348022222222",
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
  });

  it("does not send any SMS on a match", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(userRepo.findNotifiablePhones).mockResolvedValue(["+2348011111111"]);

    await cashCheckService.submitCashCheck(orgId, staffUserId, 15000);

    expect(smsGateway.sendSms).not.toHaveBeenCalled();
  });

  it("still succeeds and returns the record even when every SMS send fails", async () => {
    vi.mocked(cashCheckRepo.sumCompletedSalesTotal).mockResolvedValue(15000);
    vi.mocked(userRepo.findNotifiablePhones).mockResolvedValue(["+2348011111111"]);
    vi.mocked(smsGateway.sendSms).mockRejectedValue(new Error("Termii is down"));

    const record = await cashCheckService.submitCashCheck(orgId, staffUserId, 12000);

    expect(record.matched).toBe(false);
  });
});
