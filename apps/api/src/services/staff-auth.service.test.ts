import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/user.repository", () => ({
  findByPhone: vi.fn(),
  bindPinDevice: vi.fn(),
  updateLastLogin: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./password.service", () => ({
  verifyPassword: vi.fn(),
}));
vi.mock("./auth.service", () => ({
  issueSession: vi.fn(async () => ({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    orgId: "stub-org-id",
    userId: "stub-user-id",
    sessionFamilyId: randomUUID(),
    role: "staff",
  })),
}));
vi.mock("./rate-limit.service", () => ({
  isPinLockedOut: vi.fn(async () => false),
  recordPinFailure: vi.fn(),
  clearPinFailures: vi.fn(),
}));

import * as userRepo from "../repositories/user.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as passwordService from "./password.service";
import * as authService from "./auth.service";
import * as rateLimitService from "./rate-limit.service";
import * as staffAuthService from "./staff-auth.service";

function stubPinUser(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    orgId: randomUUID(),
    pinHash: "hashed-pin",
    pinDeviceId: null as string | null,
    role: "staff" as const,
    isActive: true,
    ...overrides,
  };
}

describe("staff-auth.service#loginWithPin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimitService.isPinLockedOut).mockResolvedValue(false);
  });

  it("issues a session on a correct phone+PIN, binding the device on first login", async () => {
    const user = stubPinUser({ pinDeviceId: null });
    vi.mocked(userRepo.findByPhone).mockResolvedValue(user as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

    const result = await staffAuthService.loginWithPin(
      { phone: "08012345678", pin: "1234", deviceId: "device-a" },
      {},
    );

    expect(result.accessToken).toBe("access-token");
    expect(userRepo.bindPinDevice).toHaveBeenCalledWith(user.orgId, user.id, "device-a");
    expect(authService.issueSession).toHaveBeenCalledWith(user.orgId, user.id, user.role, {});
    expect(rateLimitService.clearPinFailures).toHaveBeenCalledWith(user.id);
  });

  it("does not re-bind an already-bound device on a matching login", async () => {
    const user = stubPinUser({ pinDeviceId: "device-a" });
    vi.mocked(userRepo.findByPhone).mockResolvedValue(user as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

    await staffAuthService.loginWithPin(
      { phone: "08012345678", pin: "1234", deviceId: "device-a" },
      {},
    );

    expect(userRepo.bindPinDevice).not.toHaveBeenCalled();
  });

  it("rejects a correct phone+PIN from a device that doesn't match the bound one", async () => {
    const user = stubPinUser({ pinDeviceId: "device-a" });
    vi.mocked(userRepo.findByPhone).mockResolvedValue(user as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

    await expect(
      staffAuthService.loginWithPin(
        { phone: "08012345678", pin: "1234", deviceId: "device-b" },
        {},
      ),
    ).rejects.toThrow(/device isn't registered/i);

    expect(authService.issueSession).not.toHaveBeenCalled();
    expect(rateLimitService.recordPinFailure).toHaveBeenCalledWith(user.id);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.pin_login_device_mismatch" }),
    );
  });

  it("rejects a wrong PIN without issuing a session, and records the failure", async () => {
    const user = stubPinUser();
    vi.mocked(userRepo.findByPhone).mockResolvedValue(user as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);

    await expect(
      staffAuthService.loginWithPin(
        { phone: "08012345678", pin: "0000", deviceId: "device-a" },
        {},
      ),
    ).rejects.toThrow(/invalid phone number or pin/i);

    expect(authService.issueSession).not.toHaveBeenCalled();
    expect(rateLimitService.recordPinFailure).toHaveBeenCalledWith(user.id);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.pin_login_failed" }),
    );
  });

  it("rejects immediately when locked out — never calls verifyPassword at all", async () => {
    const user = stubPinUser();
    vi.mocked(userRepo.findByPhone).mockResolvedValue(user as never);
    vi.mocked(rateLimitService.isPinLockedOut).mockResolvedValue(true);

    await expect(
      staffAuthService.loginWithPin(
        { phone: "08012345678", pin: "1234", deviceId: "device-a" },
        {},
      ),
    ).rejects.toThrow(/too many failed attempts/i);

    expect(passwordService.verifyPassword).not.toHaveBeenCalled();
  });

  it("rejects a deactivated user", async () => {
    const user = stubPinUser({ isActive: false });
    vi.mocked(userRepo.findByPhone).mockResolvedValue(user as never);

    await expect(
      staffAuthService.loginWithPin(
        { phone: "08012345678", pin: "1234", deviceId: "device-a" },
        {},
      ),
    ).rejects.toThrow(/invalid phone number or pin/i);
    expect(passwordService.verifyPassword).not.toHaveBeenCalled();
  });

  it("rejects an unknown phone number with the same generic message as a wrong PIN (no enumeration)", async () => {
    vi.mocked(userRepo.findByPhone).mockResolvedValue(null);

    await expect(
      staffAuthService.loginWithPin(
        { phone: "08099999999", pin: "1234", deviceId: "device-a" },
        {},
      ),
    ).rejects.toThrow(/invalid phone number or pin/i);
  });
});
