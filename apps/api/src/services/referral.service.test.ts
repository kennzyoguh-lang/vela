import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/referral-code.repository", () => ({
  findByOrg: vi.fn(),
  create: vi.fn(),
  resolveCode: vi.fn(),
}));
vi.mock("../repositories/referral-conversion.repository", () => ({
  recordConversion: vi.fn(),
  listByOrg: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));

import * as referralCodeRepo from "../repositories/referral-code.repository";
import * as referralConversionRepo from "../repositories/referral-conversion.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as referralService from "./referral.service";
import { tierForConversionCount } from "./referral.service";

describe("referral.service#getOrCreateCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the existing code without creating a new one", async () => {
    vi.mocked(referralCodeRepo.findByOrg).mockResolvedValue({ code: "ABCD123" } as never);

    const code = await referralService.getOrCreateCode("org-1");

    expect(code).toBe("ABCD123");
    expect(referralCodeRepo.create).not.toHaveBeenCalled();
  });

  it("creates a new code when none exists yet", async () => {
    vi.mocked(referralCodeRepo.findByOrg).mockResolvedValue(null);
    vi.mocked(referralCodeRepo.create).mockResolvedValue({ code: "NEWCODE" } as never);

    const code = await referralService.getOrCreateCode("org-1");

    expect(code).toBe("NEWCODE");
    expect(referralCodeRepo.create).toHaveBeenCalledTimes(1);
  });

  it("retries with a fresh candidate on a code collision", async () => {
    vi.mocked(referralCodeRepo.findByOrg).mockResolvedValue(null);
    const collisionError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    vi.mocked(referralCodeRepo.create)
      .mockRejectedValueOnce(collisionError)
      .mockResolvedValueOnce({ code: "SECONDTRY" } as never);

    const code = await referralService.getOrCreateCode("org-1");

    expect(code).toBe("SECONDTRY");
    expect(referralCodeRepo.create).toHaveBeenCalledTimes(2);
  });
});

describe("referral.service#recordConversionIfReferred", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing for an org that was never referred", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      referredByOrgId: null,
      referredByCodeId: null,
    } as never);

    await referralService.recordConversionIfReferred("org-2", "invoice_paid");

    expect(referralConversionRepo.recordConversion).not.toHaveBeenCalled();
  });

  it("records a conversion for a referred org using the referrer's own org scope", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      referredByOrgId: "referrer-org",
      referredByCodeId: "code-1",
    } as never);
    vi.mocked(referralConversionRepo.recordConversion).mockResolvedValue(true);

    await referralService.recordConversionIfReferred("referee-org", "quick_sale_paid");

    expect(referralConversionRepo.recordConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "referrer-org",
        refereeOrgId: "referee-org",
        referralCodeId: "code-1",
        conversionEvent: "quick_sale_paid",
      }),
    );
  });

  it("silently no-ops when the org already converted (idempotent replay)", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      referredByOrgId: "referrer-org",
      referredByCodeId: "code-1",
    } as never);
    vi.mocked(referralConversionRepo.recordConversion).mockResolvedValue(false);

    await expect(
      referralService.recordConversionIfReferred("referee-org", "invoice_paid"),
    ).resolves.toBeUndefined();
  });
});

describe("referral.service#tierForConversionCount", () => {
  it("is bronze below 3 conversions", () => {
    expect(tierForConversionCount(0)).toBe("bronze");
    expect(tierForConversionCount(2)).toBe("bronze");
  });

  it("is silver at 3-9 conversions", () => {
    expect(tierForConversionCount(3)).toBe("silver");
    expect(tierForConversionCount(9)).toBe("silver");
  });

  it("is gold at 10-24 conversions", () => {
    expect(tierForConversionCount(10)).toBe("gold");
    expect(tierForConversionCount(24)).toBe("gold");
  });

  it("is platinum at 25+ conversions", () => {
    expect(tierForConversionCount(25)).toBe("platinum");
  });
});

describe("referral.service#getSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("composes the code, conversion count, tier, and reward descriptions", async () => {
    vi.mocked(referralCodeRepo.findByOrg).mockResolvedValue({ code: "ABCD123" } as never);
    vi.mocked(referralConversionRepo.listByOrg).mockResolvedValue([
      { rewardDescription: "1 month free" },
      { rewardDescription: "1 month free" },
      { rewardDescription: "1 month free" },
    ] as never);

    const summary = await referralService.getSummary("org-1");

    expect(summary).toEqual({
      code: "ABCD123",
      conversionCount: 3,
      tier: "silver",
      rewardsDescription: ["1 month free", "1 month free", "1 month free"],
    });
  });
});
