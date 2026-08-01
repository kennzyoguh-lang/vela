import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/invite.repository", () => ({
  createInvite: vi.fn(),
  listPendingForOrg: vi.fn(),
  markStatus: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByPhone: vi.fn(),
  createStaffUser: vi.fn(),
  resetPinDevice: vi.fn(),
  countOwners: vi.fn(),
  updateRole: vi.fn(),
  setActive: vi.fn(),
  updateNotificationPhone: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  setDiscountApprovalPinHash: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./password.service", () => ({
  hashPassword: vi.fn(async () => "hashed-pin"),
}));

import * as userRepo from "../repositories/user.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as passwordService from "./password.service";
import * as organisationService from "./organisation.service";

describe("organisation.service#createStaffUser", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the phone number before checking for an existing user", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);
    vi.mocked(userRepo.createStaffUser).mockResolvedValue({
      id: randomUUID(),
      name: "Amaka",
      phone: "+2348012345678",
      role: "staff",
      isActive: true,
      createdAt: new Date(),
    } as never);

    await organisationService.createStaffUser(orgId, actorId, {
      name: "Amaka",
      phone: "08012345678",
      role: "staff",
      pin: "1234",
    });

    expect(userRepo.findByPhone).toHaveBeenCalledWith("+2348012345678");
    expect(userRepo.createStaffUser).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ phone: "+2348012345678" }),
    );
  });

  it("rejects a phone number already registered to another user", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue({ id: randomUUID() } as never);

    await expect(
      organisationService.createStaffUser(orgId, actorId, {
        name: "Amaka",
        phone: "08012345678",
        role: "staff",
        pin: "1234",
      }),
    ).rejects.toThrow(/already registered/i);
    expect(userRepo.createStaffUser).not.toHaveBeenCalled();
  });

  it("hashes the PIN before storage — never passes the raw PIN to the repository", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);
    vi.mocked(userRepo.createStaffUser).mockResolvedValue({
      id: randomUUID(),
      name: "Amaka",
      phone: "+2348012345678",
      role: "staff",
      isActive: true,
      createdAt: new Date(),
    } as never);

    await organisationService.createStaffUser(orgId, actorId, {
      name: "Amaka",
      phone: "08012345678",
      role: "staff",
      pin: "1234",
    });

    expect(passwordService.hashPassword).toHaveBeenCalledWith("1234");
    expect(userRepo.createStaffUser).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ pinHash: "hashed-pin" }),
    );
  });

  it("returns a sanitized shape excluding pinHash/pinDeviceId, and writes an audit log", async () => {
    const createdId = randomUUID();
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);
    vi.mocked(userRepo.createStaffUser).mockResolvedValue({
      id: createdId,
      name: "Amaka",
      phone: "+2348012345678",
      pinHash: "hashed-pin",
      pinDeviceId: null,
      role: "staff",
      isActive: true,
      createdAt: new Date(),
    } as never);

    const result = await organisationService.createStaffUser(orgId, actorId, {
      name: "Amaka",
      phone: "08012345678",
      role: "staff",
      pin: "1234",
    });

    expect(result).not.toHaveProperty("pinHash");
    expect(result).not.toHaveProperty("pinDeviceId");
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "staff.created",
        entityId: createdId,
      }),
    );
  });

  it("generates and returns a 4-digit PIN when the caller omits one (anti-theft Piece 5 visual flow)", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);
    vi.mocked(userRepo.createStaffUser).mockResolvedValue({
      id: randomUUID(),
      name: "Amaka",
      phone: "+2348012345678",
      role: "staff",
      isActive: true,
      createdAt: new Date(),
    } as never);

    const result = await organisationService.createStaffUser(orgId, actorId, {
      name: "Amaka",
      phone: "08012345678",
      role: "staff",
    });

    expect(result.generatedPin).toMatch(/^\d{4}$/);
    expect(passwordService.hashPassword).toHaveBeenCalledWith(result.generatedPin);
  });

  it("never echoes back a PIN the caller supplied themselves", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);
    vi.mocked(userRepo.createStaffUser).mockResolvedValue({
      id: randomUUID(),
      name: "Amaka",
      phone: "+2348012345678",
      role: "staff",
      isActive: true,
      createdAt: new Date(),
    } as never);

    const result = await organisationService.createStaffUser(orgId, actorId, {
      name: "Amaka",
      phone: "08012345678",
      role: "staff",
      pin: "1234",
    });

    expect(result.generatedPin).toBeUndefined();
    expect(passwordService.hashPassword).toHaveBeenCalledWith("1234");
  });
});

describe("organisation.service#setDiscountApprovalPin", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes the PIN before storage and audit-logs the change", async () => {
    await organisationService.setDiscountApprovalPin(orgId, actorId, "4321");

    expect(passwordService.hashPassword).toHaveBeenCalledWith("4321");
    expect(organisationRepo.setDiscountApprovalPinHash).toHaveBeenCalledWith(orgId, "hashed-pin");
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "organisation.discount_approval_pin_set",
        entityType: "organisation",
        entityId: orgId,
      }),
    );
  });
});

describe("organisation.service#resetStaffDevice", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the bound device and audit-logs the reset", async () => {
    const targetUserId = randomUUID();
    vi.mocked(userRepo.findById).mockResolvedValue({ id: targetUserId } as never);

    await organisationService.resetStaffDevice(orgId, actorId, targetUserId);

    expect(userRepo.resetPinDevice).toHaveBeenCalledWith(orgId, targetUserId);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "staff.device_reset", entityId: targetUserId }),
    );
  });

  it("throws when the target user doesn't exist in this org", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    await expect(
      organisationService.resetStaffDevice(orgId, actorId, randomUUID()),
    ).rejects.toThrow(/not found/i);
    expect(userRepo.resetPinDevice).not.toHaveBeenCalled();
  });
});

describe("organisation.service#setNotificationPhone", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);
  });

  it("normalizes the phone and persists it against the caller's own user id", async () => {
    await organisationService.setNotificationPhone(orgId, actorId, "08012345678");

    expect(userRepo.updateNotificationPhone).toHaveBeenCalledWith(orgId, actorId, "+2348012345678");
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.notification_phone_set", entityId: actorId }),
    );
  });

  it("allows re-saving the caller's own already-registered phone (no-op conflict)", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue({ id: actorId } as never);

    await expect(
      organisationService.setNotificationPhone(orgId, actorId, "08012345678"),
    ).resolves.toBeUndefined();
    expect(userRepo.updateNotificationPhone).toHaveBeenCalled();
  });

  it("rejects a phone number already registered to a different user", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue({ id: randomUUID() } as never);

    await expect(
      organisationService.setNotificationPhone(orgId, actorId, "08012345678"),
    ).rejects.toThrow(/already registered/i);
    expect(userRepo.updateNotificationPhone).not.toHaveBeenCalled();
  });
});
