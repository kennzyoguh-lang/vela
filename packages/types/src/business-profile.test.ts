import { describe, it, expect } from "vitest";
import {
  computeModuleDefaults,
  applyModuleOverrides,
  computeProfileLabel,
  computeNotificationChannelDefault,
  computeAskVelaMode,
  type BusinessProfileFactors,
} from "./business-profile";

describe("computeModuleDefaults — worked examples from spec", () => {
  it("Example 1: A=one-time, B=yes, C=no (classic Ladipo-style trader with sales staff, unregistered)", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "one_time",
      hasSalesStaff: "yes",
      isCacRegistered: "no",
    };

    expect(computeModuleDefaults(factors)).toEqual({
      quickSale: true,
      invoicing: false,
      cashReconciliation: true,
      inventoryReorder: false,
      compliance: false,
      payroll: false,
      fullPnl: false,
      accountantPortal: false,
    });
  });

  it("Example 2: A=repeat, B=no, C=no (solo tailor, no staff, growing but unregistered)", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "repeat",
      hasSalesStaff: "no",
      isCacRegistered: "no",
    };

    expect(computeModuleDefaults(factors)).toEqual({
      quickSale: false,
      invoicing: true,
      // No staff to reconcile against, even though this otherwise looks
      // like a "growing" business — B is independent of A.
      cashReconciliation: false,
      inventoryReorder: true,
      compliance: false,
      payroll: false,
      fullPnl: false,
      accountantPortal: false,
    });
  });

  it("Example 3 (key bi-conditional case): A=one-time, B=no, C=yes (registered walk-in retail counter, owner-only till)", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "one_time",
      hasSalesStaff: "no",
      isCacRegistered: "yes",
    };

    expect(computeModuleDefaults(factors)).toEqual({
      quickSale: true,
      invoicing: false,
      // No staff -> hidden, even though C=yes. B must not be overridden by C.
      cashReconciliation: false,
      inventoryReorder: false,
      // Registered -> visible, even though the transaction pattern (A)
      // "feels" informal. C must not be overridden by A.
      compliance: true,
      payroll: true,
      fullPnl: true,
      accountantPortal: true,
    });
  });

  it("Example 4: A=repeat, B=yes, C=no (growing shop, has staff, not yet registered)", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "repeat",
      hasSalesStaff: "yes",
      isCacRegistered: "no",
    };

    expect(computeModuleDefaults(factors)).toEqual({
      quickSale: false,
      invoicing: true,
      cashReconciliation: true,
      inventoryReorder: true,
      // Full P&L visible via the A=repeat AND B=yes OR-branch, despite C=no.
      fullPnl: true,
      // But compliance/payroll stay hidden — no legal filing obligations
      // yet. Showing ComplianceRadar here would be actively misleading.
      compliance: false,
      payroll: false,
      accountantPortal: false,
    });
  });

  it("Example 5: all answers unsure/mixed or skipped — safest, most inclusive middle ground", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "unsure",
      hasSalesStaff: "unsure",
      isCacRegistered: "unsure",
    };

    expect(computeModuleDefaults(factors)).toEqual({
      // Both visible — never force a choice, never leave the business
      // without an obvious way to collect payment.
      quickSale: true,
      invoicing: true,
      // Never assume staff exist.
      cashReconciliation: false,
      inventoryReorder: true,
      // Never assume formal legal obligations without an explicit "yes".
      compliance: false,
      payroll: false,
      fullPnl: false,
      accountantPortal: false,
    });
    // "unsure" is not "yes" for Factor C, so Ask Vela stays in simplified mode.
    expect(computeAskVelaMode(factors)).toBe("simplified");
  });
});

describe("applyModuleOverrides", () => {
  it("lets a manual override win over the computed default in either direction", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "one_time",
      hasSalesStaff: "no",
      isCacRegistered: "no",
    };
    const defaults = computeModuleDefaults(factors);
    expect(defaults.invoicing).toBe(false);
    expect(defaults.quickSale).toBe(true);

    const result = applyModuleOverrides(defaults, { invoicing: true, quickSale: false });

    expect(result.invoicing).toBe(true);
    expect(result.quickSale).toBe(false);
    // Everything else stays at its computed default.
    expect(result.cashReconciliation).toBe(defaults.cashReconciliation);
  });

  it("an empty overrides object changes nothing", () => {
    const factors: BusinessProfileFactors = {
      customerPattern: "repeat",
      hasSalesStaff: "yes",
      isCacRegistered: "yes",
    };
    const defaults = computeModuleDefaults(factors);

    expect(applyModuleOverrides(defaults, {})).toEqual(defaults);
  });
});

describe("computeAskVelaMode", () => {
  it("is full when CAC-registered", () => {
    expect(
      computeAskVelaMode({
        customerPattern: "unsure",
        hasSalesStaff: "no",
        isCacRegistered: "yes",
      }),
    ).toBe("full");
  });

  it("is simplified when not CAC-registered", () => {
    expect(
      computeAskVelaMode({ customerPattern: "unsure", hasSalesStaff: "no", isCacRegistered: "no" }),
    ).toBe("simplified");
  });
});

describe("computeProfileLabel", () => {
  it("scores 0 -> informal", () => {
    expect(
      computeProfileLabel({
        customerPattern: "one_time",
        hasSalesStaff: "no",
        isCacRegistered: "no",
      }),
    ).toBe("informal");
  });

  it("scores 1 -> semi_formal", () => {
    expect(
      computeProfileLabel({
        customerPattern: "repeat",
        hasSalesStaff: "no",
        isCacRegistered: "no",
      }),
    ).toBe("semi_formal");
  });

  it("scores 2 -> semi_formal", () => {
    expect(
      computeProfileLabel({
        customerPattern: "repeat",
        hasSalesStaff: "yes",
        isCacRegistered: "no",
      }),
    ).toBe("semi_formal");
  });

  it("scores 3 -> formal", () => {
    expect(
      computeProfileLabel({
        customerPattern: "repeat",
        hasSalesStaff: "yes",
        isCacRegistered: "yes",
      }),
    ).toBe("formal");
  });

  it("'unsure' never contributes to the score, same as 'no'", () => {
    expect(
      computeProfileLabel({
        customerPattern: "unsure",
        hasSalesStaff: "unsure",
        isCacRegistered: "unsure",
      }),
    ).toBe("informal");
  });
});

describe("computeNotificationChannelDefault", () => {
  it("defaults to whatsapp_sms for the informal label", () => {
    expect(
      computeNotificationChannelDefault({
        customerPattern: "one_time",
        hasSalesStaff: "no",
        isCacRegistered: "no",
      }),
    ).toBe("whatsapp_sms");
  });

  it("defaults to email for semi_formal", () => {
    expect(
      computeNotificationChannelDefault({
        customerPattern: "repeat",
        hasSalesStaff: "no",
        isCacRegistered: "no",
      }),
    ).toBe("email");
  });

  it("defaults to email for formal", () => {
    expect(
      computeNotificationChannelDefault({
        customerPattern: "repeat",
        hasSalesStaff: "yes",
        isCacRegistered: "yes",
      }),
    ).toBe("email");
  });

  it("Factor C='yes' forces email even when A and B would otherwise pull the score down", () => {
    // A=one_time (0) + B=no (0) + C=yes (1) = score 1 -> semi_formal already
    // maps to email under the base rule, but this test exists specifically
    // to prove the EXPLICIT override path is exercised (see the function's
    // own comment on why this must not rely on the score alone).
    expect(
      computeNotificationChannelDefault({
        customerPattern: "one_time",
        hasSalesStaff: "no",
        isCacRegistered: "yes",
      }),
    ).toBe("email");
  });
});
