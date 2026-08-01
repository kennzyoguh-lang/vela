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

import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
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
