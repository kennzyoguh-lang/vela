import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/product.repository", () => ({
  findManyByIds: vi.fn(),
}));
vi.mock("../repositories/sale.repository", () => ({
  createSale: vi.fn(),
  listByOrg: vi.fn(),
}));
vi.mock("../repositories/organisation.repository", () => ({
  findOrganisationById: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./password.service", () => ({
  verifyPassword: vi.fn(),
}));
vi.mock("./rate-limit.service", () => ({
  isDiscountApprovalLockedOut: vi.fn(),
  recordDiscountApprovalFailure: vi.fn(),
  clearDiscountApprovalFailures: vi.fn(),
}));

import * as productRepo from "../repositories/product.repository";
import * as saleRepo from "../repositories/sale.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import * as passwordService from "./password.service";
import * as rateLimitService from "./rate-limit.service";
import * as saleService from "./sale.service";

describe("sale.service#logSale", () => {
  const orgId = randomUUID();
  const staffUserId = randomUUID();
  const productId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saleRepo.createSale).mockResolvedValue({ id: randomUUID() } as never);
    vi.mocked(rateLimitService.isDiscountApprovalLockedOut).mockResolvedValue(false);
  });

  it("computes the total from the catalog price, ignoring anything resembling a client-sent price", async () => {
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: true },
    ] as never);

    await saleService.logSale(orgId, staffUserId, "staff", {
      // @ts-expect-error deliberately probing a client-sent price the schema
      // doesn't even define a field for — the service must never read it.
      items: [{ productId, quantity: 3, price: 1 }],
    });

    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({
        staffUserId,
        total: 4500, // 1500 * 3, the catalog price — never the smuggled price: 1
        discountAmount: 0,
        currency: "NGN",
        items: [
          expect.objectContaining({
            productId,
            productName: "Phone case",
            unitPrice: 1500,
            quantity: 3,
            lineTotal: 4500,
          }),
        ],
      }),
    );
  });

  it("rejects an unknown product id", async () => {
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([]);

    await expect(
      saleService.logSale(orgId, staffUserId, "staff", {
        items: [{ productId, quantity: 1 }],
      }),
    ).rejects.toThrow(/not found/i);
    expect(saleRepo.createSale).not.toHaveBeenCalled();
  });

  it("rejects a deactivated product", async () => {
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: false },
    ] as never);

    await expect(
      saleService.logSale(orgId, staffUserId, "staff", {
        items: [{ productId, quantity: 1 }],
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("sums multiple line items into one total", async () => {
    const productId2 = randomUUID();
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: true },
      { id: productId2, name: "Charger", price: 3000, currency: "NGN", isActive: true },
    ] as never);

    await saleService.logSale(orgId, staffUserId, "staff", {
      items: [
        { productId, quantity: 2 },
        { productId: productId2, quantity: 1 },
      ],
    });

    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ total: 6000 }), // (1500*2) + (3000*1)
    );
  });
});

describe("sale.service#logSale — discount approval (anti-theft Piece 4)", () => {
  const orgId = randomUUID();
  const staffUserId = randomUUID();
  const productId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saleRepo.createSale).mockResolvedValue({ id: randomUUID() } as never);
    vi.mocked(rateLimitService.isDiscountApprovalLockedOut).mockResolvedValue(false);
    vi.mocked(productRepo.findManyByIds).mockResolvedValue([
      { id: productId, name: "Phone case", price: 1500, currency: "NGN", isActive: true },
    ] as never);
  });

  it("rejects a staff discount when the org has no approval PIN set up, without ever checking a PIN", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      discountApprovalPinHash: null,
    } as never);

    await expect(
      saleService.logSale(orgId, staffUserId, "staff", {
        items: [{ productId, quantity: 1 }],
        discountAmount: 200,
      }),
    ).rejects.toThrow(/ask your manager to set up/i);
    expect(passwordService.verifyPassword).not.toHaveBeenCalled();
    expect(saleRepo.createSale).not.toHaveBeenCalled();
  });

  it("locked-out org is rejected before the PIN is ever checked", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      discountApprovalPinHash: "hash",
    } as never);
    vi.mocked(rateLimitService.isDiscountApprovalLockedOut).mockResolvedValue(true);

    await expect(
      saleService.logSale(orgId, staffUserId, "staff", {
        items: [{ productId, quantity: 1 }],
        discountAmount: 200,
        approvalPin: "1234",
      }),
    ).rejects.toThrow(/too many wrong attempts/i);
    expect(passwordService.verifyPassword).not.toHaveBeenCalled();
  });

  it("wrong PIN is rejected with the friendly copy and records a failure", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      discountApprovalPinHash: "hash",
    } as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(false);

    await expect(
      saleService.logSale(orgId, staffUserId, "staff", {
        items: [{ productId, quantity: 1 }],
        discountAmount: 200,
        approvalPin: "0000",
      }),
    ).rejects.toThrow(/ask your manager to approve this discount/i);
    expect(rateLimitService.recordDiscountApprovalFailure).toHaveBeenCalledWith(orgId);
    expect(saleRepo.createSale).not.toHaveBeenCalled();
  });

  it("missing PIN on a discounted sale is rejected the same as a wrong one", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      discountApprovalPinHash: "hash",
    } as never);

    await expect(
      saleService.logSale(orgId, staffUserId, "staff", {
        items: [{ productId, quantity: 1 }],
        discountAmount: 200,
      }),
    ).rejects.toThrow(/ask your manager to approve this discount/i);
    expect(passwordService.verifyPassword).not.toHaveBeenCalled();
  });

  it("correct PIN applies the discount, clears failures, and audit-logs it", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      discountApprovalPinHash: "hash",
    } as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

    await saleService.logSale(orgId, staffUserId, "staff", {
      items: [{ productId, quantity: 2 }], // subtotal 3000
      discountAmount: 500,
      approvalPin: "1234",
    });

    expect(rateLimitService.clearDiscountApprovalFailures).toHaveBeenCalledWith(orgId);
    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ total: 2500, discountAmount: 500 }),
    );
    expect(auditLogRepo.write).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        action: "sale.discount_applied",
        newValue: expect.objectContaining({ subtotal: 3000, discountAmount: 500, total: 2500 }),
      }),
    );
  });

  it("clamps a discount larger than the subtotal instead of going negative", async () => {
    vi.mocked(organisationRepo.findOrganisationById).mockResolvedValue({
      discountApprovalPinHash: "hash",
    } as never);
    vi.mocked(passwordService.verifyPassword).mockResolvedValue(true);

    await saleService.logSale(orgId, staffUserId, "staff", {
      items: [{ productId, quantity: 1 }], // subtotal 1500
      discountAmount: 9999,
      approvalPin: "1234",
    });

    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ total: 0, discountAmount: 1500 }),
    );
  });

  it("owner applying their own discount needs no approval PIN at all", async () => {
    await saleService.logSale(orgId, staffUserId, "owner", {
      items: [{ productId, quantity: 2 }], // subtotal 3000
      discountAmount: 500,
    });

    expect(organisationRepo.findOrganisationById).not.toHaveBeenCalled();
    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ total: 2500, discountAmount: 500 }),
    );
  });

  it("admin applying their own discount also needs no approval PIN", async () => {
    await saleService.logSale(orgId, staffUserId, "admin", {
      items: [{ productId, quantity: 1 }],
      discountAmount: 100,
    });

    expect(organisationRepo.findOrganisationById).not.toHaveBeenCalled();
    expect(saleRepo.createSale).toHaveBeenCalledWith(
      orgId,
      expect.objectContaining({ discountAmount: 100 }),
    );
  });
});
