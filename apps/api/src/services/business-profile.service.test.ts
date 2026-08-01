import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
  setBusinessProfileFactors: vi.fn(),
  setModuleOverride: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  countActiveStaffRole: vi.fn(),
}));
vi.mock("../repositories/sale.repository", () => ({
  hasRepeatCustomer: vi.fn(),
}));

import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as userRepo from "../repositories/user.repository";
import * as saleRepo from "../repositories/sale.repository";
import * as businessProfileService from "./business-profile.service";

describe("business-profile.service#getBusinessProfile", () => {
  const orgId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("returns only the raw factors and overrides — never a computed visibility map or label", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      customerPattern: "repeat",
      hasSalesStaff: "yes",
      isCacRegistered: "no",
      moduleOverrides: { quickSale: false },
      profileFactorsConfirmedAt: new Date("2026-08-01T00:00:00Z"),
    } as never);

    const result = await businessProfileService.getBusinessProfile(orgId);

    expect(result).toEqual({
      customerPattern: "repeat",
      hasSalesStaff: "yes",
      isCacRegistered: "no",
      moduleOverrides: { quickSale: false },
      profileFactorsConfirmedAt: new Date("2026-08-01T00:00:00Z"),
    });
  });

  it("throws NotFoundError for an unknown organisation", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue(null);

    await expect(businessProfileService.getBusinessProfile(orgId)).rejects.toThrow(/not found/i);
  });
});

describe("business-profile.service#setBusinessProfileFactors", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("persists the three factors and audit-logs the change", async () => {
    const factors = {
      customerPattern: "one_time" as const,
      hasSalesStaff: "no" as const,
      isCacRegistered: "yes" as const,
    };

    await businessProfileService.setBusinessProfileFactors(orgId, actorId, factors);

    expect(organisationRepo.setBusinessProfileFactors).toHaveBeenCalledWith(orgId, factors);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "organisation.business_profile_factors_set",
        entityType: "organisation",
        entityId: orgId,
        newValue: factors,
      }),
    );
  });
});

describe("business-profile.service#setModuleOverride", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("persists a reveal override and audit-logs it", async () => {
    await businessProfileService.setModuleOverride(orgId, actorId, "compliance", true);

    expect(organisationRepo.setModuleOverride).toHaveBeenCalledWith(orgId, "compliance", true);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organisation.module_override_set",
        newValue: { moduleKey: "compliance", value: true },
      }),
    );
  });

  it("persists a null override to clear back to the computed default", async () => {
    await businessProfileService.setModuleOverride(orgId, actorId, "compliance", null);

    expect(organisationRepo.setModuleOverride).toHaveBeenCalledWith(orgId, "compliance", null);
  });

  it("rejects an unknown module key before touching the repository", async () => {
    await expect(
      businessProfileService.setModuleOverride(orgId, actorId, "not_a_real_module", true),
    ).rejects.toThrow(/unknown module/i);
    expect(organisationRepo.setModuleOverride).not.toHaveBeenCalled();
  });
});

describe("business-profile.service#getGraduationPrompts", () => {
  const orgId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  function mockProfile(overrides: Partial<Record<string, unknown>> = {}) {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      customerPattern: "unsure",
      hasSalesStaff: "unsure",
      isCacRegistered: "unsure",
      moduleOverrides: {},
      profileFactorsConfirmedAt: new Date(),
      ...overrides,
    } as never);
  }

  it("suggests hasSalesStaff=yes once 2+ active staff accounts exist while the factor says no", async () => {
    mockProfile({ hasSalesStaff: "no" });
    vi.mocked(userRepo.countActiveStaffRole).mockResolvedValue(2);
    vi.mocked(saleRepo.hasRepeatCustomer).mockResolvedValue(false);

    const prompts = await businessProfileService.getGraduationPrompts(orgId);

    expect(prompts).toEqual([
      expect.objectContaining({ factor: "hasSalesStaff", suggestedValue: "yes" }),
    ]);
  });

  it("does not suggest hasSalesStaff=yes with only 1 staff account", async () => {
    mockProfile({ hasSalesStaff: "no" });
    vi.mocked(userRepo.countActiveStaffRole).mockResolvedValue(1);
    vi.mocked(saleRepo.hasRepeatCustomer).mockResolvedValue(false);

    const prompts = await businessProfileService.getGraduationPrompts(orgId);

    expect(prompts).toEqual([]);
  });

  it("never checks staff count when hasSalesStaff is already yes or unsure", async () => {
    mockProfile({ hasSalesStaff: "yes" });

    const prompts = await businessProfileService.getGraduationPrompts(orgId);

    expect(userRepo.countActiveStaffRole).not.toHaveBeenCalled();
    expect(prompts).toEqual([]);
  });

  it("suggests customerPattern=repeat once a repeat customer is detected while the factor says one_time", async () => {
    mockProfile({ customerPattern: "one_time" });
    vi.mocked(userRepo.countActiveStaffRole).mockResolvedValue(0);
    vi.mocked(saleRepo.hasRepeatCustomer).mockResolvedValue(true);

    const prompts = await businessProfileService.getGraduationPrompts(orgId);

    expect(saleRepo.hasRepeatCustomer).toHaveBeenCalledWith(orgId, 3);
    expect(prompts).toEqual([
      expect.objectContaining({ factor: "customerPattern", suggestedValue: "repeat" }),
    ]);
  });

  it("can return both prompts at once when both signals contradict their factors", async () => {
    mockProfile({ hasSalesStaff: "no", customerPattern: "one_time" });
    vi.mocked(userRepo.countActiveStaffRole).mockResolvedValue(3);
    vi.mocked(saleRepo.hasRepeatCustomer).mockResolvedValue(true);

    const prompts = await businessProfileService.getGraduationPrompts(orgId);

    expect(prompts).toHaveLength(2);
  });

  it("never suggests anything about isCacRegistered — usage can't contradict that factor", async () => {
    mockProfile({ hasSalesStaff: "no", customerPattern: "one_time", isCacRegistered: "no" });
    vi.mocked(userRepo.countActiveStaffRole).mockResolvedValue(5);
    vi.mocked(saleRepo.hasRepeatCustomer).mockResolvedValue(true);

    const prompts = await businessProfileService.getGraduationPrompts(orgId);

    expect(prompts.map((p) => p.factor)).not.toContain("isCacRegistered");
  });
});

describe("business-profile.service#confirmGraduationPrompt", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      customerPattern: "one_time",
      hasSalesStaff: "no",
      isCacRegistered: "unsure",
      moduleOverrides: {},
      profileFactorsConfirmedAt: new Date(),
    } as never);
  });

  it("updates only hasSalesStaff, leaving the other two factors exactly as they were", async () => {
    await businessProfileService.confirmGraduationPrompt(orgId, actorId, {
      factor: "hasSalesStaff",
      value: "yes",
    });

    expect(organisationRepo.setBusinessProfileFactors).toHaveBeenCalledWith(orgId, {
      customerPattern: "one_time",
      hasSalesStaff: "yes",
      isCacRegistered: "unsure",
    });
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organisation.graduation_confirmed",
        newValue: { factor: "hasSalesStaff", value: "yes" },
      }),
    );
  });

  it("updates only customerPattern, leaving the other two factors exactly as they were", async () => {
    await businessProfileService.confirmGraduationPrompt(orgId, actorId, {
      factor: "customerPattern",
      value: "repeat",
    });

    expect(organisationRepo.setBusinessProfileFactors).toHaveBeenCalledWith(orgId, {
      customerPattern: "repeat",
      hasSalesStaff: "no",
      isCacRegistered: "unsure",
    });
  });

  it("rejects a mismatched factor/value pair before touching the repository", async () => {
    await expect(
      businessProfileService.confirmGraduationPrompt(orgId, actorId, {
        factor: "hasSalesStaff",
        value: "repeat",
      }),
    ).rejects.toThrow(/invalid value/i);
    expect(organisationRepo.setBusinessProfileFactors).not.toHaveBeenCalled();
  });
});
