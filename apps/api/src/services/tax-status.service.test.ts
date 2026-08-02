import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
  setTaxProfile: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));

import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as taxStatusService from "./tax-status.service";
import { computeSmallCompanyStatus, citRateFor } from "./tax-status.service";

describe("tax-status.service#computeSmallCompanyStatus", () => {
  it("is 'unknown' when any of the three inputs hasn't been supplied", () => {
    expect(
      computeSmallCompanyStatus({
        annualTurnover: null,
        fixedAssetsValue: 100_000_000,
        providesProfessionalServices: false,
      }),
    ).toBe("unknown");
    expect(
      computeSmallCompanyStatus({
        annualTurnover: 10_000_000,
        fixedAssetsValue: null,
        providesProfessionalServices: false,
      }),
    ).toBe("unknown");
    expect(
      computeSmallCompanyStatus({
        annualTurnover: 10_000_000,
        fixedAssetsValue: 100_000_000,
        providesProfessionalServices: null,
      }),
    ).toBe("unknown");
  });

  it("is 'small' at or below both the turnover and fixed-assets thresholds", () => {
    expect(
      computeSmallCompanyStatus({
        annualTurnover: 50_000_000,
        fixedAssetsValue: 250_000_000,
        providesProfessionalServices: false,
      }),
    ).toBe("small");
  });

  it("is 'standard' above the turnover threshold", () => {
    expect(
      computeSmallCompanyStatus({
        annualTurnover: 50_000_001,
        fixedAssetsValue: 100_000_000,
        providesProfessionalServices: false,
      }),
    ).toBe("standard");
  });

  it("is 'standard' above the fixed-assets threshold even with low turnover", () => {
    expect(
      computeSmallCompanyStatus({
        annualTurnover: 1_000_000,
        fixedAssetsValue: 250_000_001,
        providesProfessionalServices: false,
      }),
    ).toBe("standard");
  });

  it("is 'standard' for a professional-services provider regardless of size", () => {
    expect(
      computeSmallCompanyStatus({
        annualTurnover: 1_000_000,
        fixedAssetsValue: 1_000_000,
        providesProfessionalServices: true,
      }),
    ).toBe("standard");
  });
});

describe("tax-status.service#citRateFor", () => {
  it("is null for 'unknown'", () => {
    expect(citRateFor("unknown")).toBeNull();
  });

  it("is 0 for 'small'", () => {
    expect(citRateFor("small")).toBe(0);
  });

  it("is 0.30 for 'standard'", () => {
    expect(citRateFor("standard")).toBe(0.3);
  });
});

describe("tax-status.service#getTaxStatus", () => {
  const orgId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("returns raw inputs plus the computed status, rate, and summary", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      annualTurnover: "20000000",
      fixedAssetsValue: "50000000",
      providesProfessionalServices: false,
    } as never);

    const result = await taxStatusService.getTaxStatus(orgId);

    expect(result).toEqual({
      annualTurnover: 20_000_000,
      fixedAssetsValue: 50_000_000,
      providesProfessionalServices: false,
      status: "small",
      citRate: 0,
      summary: expect.stringContaining("Small Company"),
    });
  });

  it("throws NotFoundError for an unknown organisation", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue(null);
    await expect(taxStatusService.getTaxStatus(orgId)).rejects.toThrow(/not found/i);
  });
});

describe("tax-status.service#setTaxProfile", () => {
  const orgId = randomUUID();
  const actorId = randomUUID();

  beforeEach(() => vi.clearAllMocks());

  it("persists the profile and audit-logs the change", async () => {
    const profile = {
      annualTurnover: 30_000_000,
      fixedAssetsValue: 80_000_000,
      providesProfessionalServices: false,
    };

    await taxStatusService.setTaxProfile(orgId, actorId, profile);

    expect(organisationRepo.setTaxProfile).toHaveBeenCalledWith(orgId, profile);
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        userId: actorId,
        action: "organisation.tax_profile_set",
        newValue: profile,
      }),
    );
  });
});
