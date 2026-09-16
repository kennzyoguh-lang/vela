import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/invoice.repository", () => ({
  listAllByOrg: vi.fn(),
}));
vi.mock("../repositories/client.repository", () => ({
  findById: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
// Avoids pulling in lib/env.ts's full schema parse (DATABASE_URL, JWT keys,
// etc.) just for this file's one read of WEB_APP_URL — same convention as
// quick-sale.service.test.ts, which needs the same variable for the same
// reason (both build a /pay/:token URL).
vi.mock("../lib/env", () => ({
  env: { WEB_APP_URL: "https://app.vela.test" },
}));
vi.mock("./email/email.gateway", () => ({
  sendEmail: vi.fn(),
}));

import * as invoiceRepo from "../repositories/invoice.repository";
import * as clientRepo from "../repositories/client.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as emailGateway from "./email/email.gateway";
import { reminderTriggerFor, processRemindersForOrg } from "./reminder.service";

function daysFromNow(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

describe("reminder.service — reminderTriggerFor (BRD F-04's fixed sequence)", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("fires due_in_7_days exactly 7 days before due", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 7) }, now)).toBe("due_in_7_days");
  });

  it("fires due_today exactly on the due date", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 0) }, now)).toBe("due_today");
  });

  it("fires overdue_3_days exactly 3 days after due", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, -3) }, now)).toBe("overdue_3_days");
  });

  it("fires overdue_7_days exactly 7 days after due", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, -7) }, now)).toBe("overdue_7_days");
  });

  it("does not fire one day off any boundary (6 days before due)", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 6) }, now)).toBeNull();
  });

  it("does not fire one day off any boundary (8 days overdue)", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, -8) }, now)).toBeNull();
  });

  it("does not fire for an invoice far from any trigger point", () => {
    expect(reminderTriggerFor({ dueDate: daysFromNow(now, 20) }, now)).toBeNull();
  });
});

describe("reminder.service#processRemindersForOrg", () => {
  const orgId = randomUUID();
  const now = new Date("2026-06-15T12:00:00Z");

  function invoiceStub(overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      number: "INV-0001",
      clientId: randomUUID(),
      status: "sent",
      total: 50_000,
      currency: "NGN",
      dueDate: daysFromNow(now, 7),
      paymentPortalToken: "token-abc",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      name: "Acme Traders",
    } as never);
    vi.mocked(emailGateway.sendEmail).mockResolvedValue(undefined);
  });

  it("emails the client when an invoice hits a trigger day and has an email on file", async () => {
    const invoice = invoiceStub();
    vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([invoice] as never);
    vi.mocked(clientRepo.findById).mockResolvedValue({
      name: "Bola's Bakery",
      email: "bola@example.com",
    } as never);

    const sent = await processRemindersForOrg(orgId, now);

    expect(sent).toBe(1);
    expect(emailGateway.sendEmail).toHaveBeenCalledWith(
      "bola@example.com",
      expect.stringContaining("INV-0001"),
      expect.stringContaining("token-abc"),
      expect.any(String),
    );
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ orgId, action: "invoice.reminder_sent", entityId: invoice.id }),
    );
  });

  it("skips delivery (and does not audit-log) when the client has no email on file", async () => {
    vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([invoiceStub()] as never);
    vi.mocked(clientRepo.findById).mockResolvedValue({
      name: "Bola's Bakery",
      email: null,
    } as never);

    const sent = await processRemindersForOrg(orgId, now);

    expect(sent).toBe(0);
    expect(emailGateway.sendEmail).not.toHaveBeenCalled();
    expect(auditLogRepo.write).not.toHaveBeenCalled();
  });

  it("does not fire for an invoice not on a trigger day", async () => {
    vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([
      invoiceStub({ dueDate: daysFromNow(now, 20) }),
    ] as never);

    const sent = await processRemindersForOrg(orgId, now);

    expect(sent).toBe(0);
    expect(clientRepo.findById).not.toHaveBeenCalled();
  });

  it("skips paid, written-off, void, and draft invoices even on a trigger day", async () => {
    vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([
      invoiceStub({ status: "paid" }),
      invoiceStub({ status: "written_off" }),
      invoiceStub({ status: "void" }),
      invoiceStub({ status: "draft" }),
    ] as never);

    const sent = await processRemindersForOrg(orgId, now);

    expect(sent).toBe(0);
    expect(emailGateway.sendEmail).not.toHaveBeenCalled();
  });

  it("keeps processing remaining invoices when one client's email send fails", async () => {
    const failing = invoiceStub({ number: "INV-0001" });
    const succeeding = invoiceStub({ number: "INV-0002" });
    vi.mocked(invoiceRepo.listAllByOrg).mockResolvedValue([failing, succeeding] as never);
    vi.mocked(clientRepo.findById)
      .mockResolvedValueOnce({ name: "Client A", email: "a@example.com" } as never)
      .mockResolvedValueOnce({ name: "Client B", email: "b@example.com" } as never);
    vi.mocked(emailGateway.sendEmail)
      .mockRejectedValueOnce(new Error("Resend is down"))
      .mockResolvedValueOnce(undefined);

    const sent = await processRemindersForOrg(orgId, now);

    expect(sent).toBe(1);
    expect(emailGateway.sendEmail).toHaveBeenCalledTimes(2);
  });
});
