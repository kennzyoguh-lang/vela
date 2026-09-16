import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/compliance-filing.repository", () => ({
  listByOrg: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
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

import * as filingRepo from "../repositories/compliance-filing.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as smsGateway from "./sms/termii.gateway";
import * as emailGateway from "./email/email.gateway";
import * as businessProfileService from "./business-profile.service";
import {
  complianceReminderTriggerFor,
  composeComplianceReminderMessage,
  processComplianceRemindersForOrg,
} from "./compliance-reminder.service";

const UNSURE_FACTORS = {
  customerPattern: "unsure" as const,
  hasSalesStaff: "unsure" as const,
  isCacRegistered: "unsure" as const,
  moduleOverrides: {},
  profileFactorsConfirmedAt: null,
};

function daysFromNow(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

describe("compliance-reminder.service#complianceReminderTriggerFor", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("fires due_in_7_days exactly 7 days before due", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, 7) }, now)).toBe(
      "due_in_7_days",
    );
  });

  it("fires due_tomorrow exactly 1 day before due", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, 1) }, now)).toBe(
      "due_tomorrow",
    );
  });

  it("fires due_today exactly on the due date", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, 0) }, now)).toBe("due_today");
  });

  it("fires overdue_3_days exactly 3 days after due", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, -3) }, now)).toBe(
      "overdue_3_days",
    );
  });

  it("fires overdue_7_days exactly 7 days after due", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, -7) }, now)).toBe(
      "overdue_7_days",
    );
  });

  it("does not fire one day off any boundary (6 days before due)", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, 6) }, now)).toBeNull();
  });

  it("does not fire for a filing far from any trigger point", () => {
    expect(complianceReminderTriggerFor({ dueDate: daysFromNow(now, 20) }, now)).toBeNull();
  });
});

describe("compliance-reminder.service#composeComplianceReminderMessage", () => {
  it("names the obligation and says what to do, no jargon", () => {
    const message = composeComplianceReminderMessage({ obligationType: "vat" }, "due_today");
    expect(message).toBe("VAT return is due today. File now to avoid penalties.");
  });

  it("phrases an overdue filing distinctly from an upcoming one", () => {
    const message = composeComplianceReminderMessage({ obligationType: "paye" }, "overdue_7_days");
    expect(message).toBe("PAYE remittance is now 7 days overdue. File now to avoid penalties.");
  });
});

describe("compliance-reminder.service#processComplianceRemindersForOrg", () => {
  const orgId = randomUUID();
  const now = new Date("2026-06-15T12:00:00Z");

  function filingStub(overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      orgId,
      obligationType: "vat",
      dueDate: daysFromNow(now, 0),
      filedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([]);
    vi.mocked(smsGateway.sendSms).mockResolvedValue(undefined);
    vi.mocked(emailGateway.sendEmail).mockResolvedValue(undefined);
    vi.mocked(businessProfileService.getBusinessProfile).mockResolvedValue(UNSURE_FACTORS as never);
  });

  it("skips a filing that has already been filed, even on a trigger day", async () => {
    vi.mocked(filingRepo.listByOrg).mockResolvedValue([
      filingStub({ filedAt: new Date() }),
    ] as never);

    const sent = await processComplianceRemindersForOrg(orgId, now);

    expect(sent).toBe(0);
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });

  it("skips a filing not on any trigger day", async () => {
    vi.mocked(filingRepo.listByOrg).mockResolvedValue([
      filingStub({ dueDate: daysFromNow(now, 20) }),
    ] as never);

    const sent = await processComplianceRemindersForOrg(orgId, now);

    expect(sent).toBe(0);
  });

  it("sends via SMS for an informal (all-unsure) org and audit-logs the channel", async () => {
    const filing = filingStub();
    vi.mocked(filingRepo.listByOrg).mockResolvedValue([filing] as never);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: "owner@example.com" },
    ]);

    const sent = await processComplianceRemindersForOrg(orgId, now);

    expect(sent).toBe(1);
    expect(smsGateway.sendSms).toHaveBeenCalledWith(
      "+2348011111111",
      expect.stringContaining("VAT return"),
    );
    expect(emailGateway.sendEmail).not.toHaveBeenCalled();
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        action: "compliance.reminder_sent",
        entityId: filing.id,
        newValue: expect.objectContaining({ channel: "whatsapp_sms" }),
      }),
    );
  });

  it("sends via email for a CAC-registered org", async () => {
    vi.mocked(filingRepo.listByOrg).mockResolvedValue([
      filingStub({ obligationType: "paye" }),
    ] as never);
    vi.mocked(businessProfileService.getBusinessProfile).mockResolvedValue({
      ...UNSURE_FACTORS,
      isCacRegistered: "yes",
    } as never);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: null, email: "owner@example.com" },
    ]);

    await processComplianceRemindersForOrg(orgId, now);

    expect(emailGateway.sendEmail).toHaveBeenCalledWith(
      "owner@example.com",
      expect.stringContaining("PAYE remittance"),
      expect.stringContaining("PAYE remittance"),
    );
    expect(smsGateway.sendSms).not.toHaveBeenCalled();
  });

  it("still audit-logs when no owner/admin contact is configured at all", async () => {
    vi.mocked(filingRepo.listByOrg).mockResolvedValue([filingStub()] as never);

    const sent = await processComplianceRemindersForOrg(orgId, now);

    expect(sent).toBe(1);
    expect(smsGateway.sendSms).not.toHaveBeenCalled();
    expect(auditLogRepo.write).toHaveBeenCalled();
  });

  it("keeps processing remaining filings when one SMS send fails", async () => {
    const failing = filingStub({ obligationType: "vat" });
    const succeeding = filingStub({ obligationType: "wht" });
    vi.mocked(filingRepo.listByOrg).mockResolvedValue([failing, succeeding] as never);
    vi.mocked(userRepo.findNotifiableRecipients).mockResolvedValue([
      { phone: "+2348011111111", email: null },
    ]);
    vi.mocked(smsGateway.sendSms)
      .mockRejectedValueOnce(new Error("Termii is down"))
      .mockResolvedValueOnce(undefined);

    const sent = await processComplianceRemindersForOrg(orgId, now);

    // Both are still counted "sent" (attempted + audited) — per-recipient
    // delivery failure isolation, same contract as owner-summary's SMS loop.
    expect(sent).toBe(2);
    expect(smsGateway.sendSms).toHaveBeenCalledTimes(2);
    expect(auditLogRepo.write).toHaveBeenCalledTimes(2);
  });
});
