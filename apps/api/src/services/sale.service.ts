import * as productRepo from "../repositories/product.repository";
import * as saleRepo from "../repositories/sale.repository";
import * as organisationRepo from "../repositories/organisation.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { verifyPassword } from "./password.service";
import {
  isDiscountApprovalLockedOut,
  recordDiscountApprovalFailure,
  clearDiscountApprovalFailures,
} from "./rate-limit.service";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import type { PageParams } from "../lib/pagination";
import type { CreateSaleInput } from "../validation/sale.schema";

/**
 * Anti-theft Piece 4's staff-proof guardrail — a staff-role sale with a
 * discount only goes through if the org's shared approval PIN (set by an
 * owner/admin, see organisation.service.ts#setDiscountApprovalPin) is
 * supplied and correct. Owner/admin submitting their own sale don't need
 * it — they ARE the approver. Throws the exact plain-language copy the
 * staff screen shows verbatim (no forms, no technical permission error),
 * per the spec's explicit "Ask your manager..." requirement.
 */
async function verifyDiscountApproval(
  orgId: string,
  role: string,
  approvalPin: string | undefined,
): Promise<void> {
  if (role !== "staff") return;

  const org = await organisationRepo.findOrganisationById(orgId);
  if (!org?.discountApprovalPinHash) {
    throw new BusinessRuleViolationError("Ask your manager to set up discount approval first");
  }

  if (await isDiscountApprovalLockedOut(orgId)) {
    throw new BusinessRuleViolationError(
      "Too many wrong attempts — ask your manager to try again in 15 minutes",
    );
  }

  const pinOk = approvalPin
    ? await verifyPassword(approvalPin, org.discountApprovalPinHash)
    : false;
  if (!pinOk) {
    await recordDiscountApprovalFailure(orgId);
    throw new BusinessRuleViolationError("Ask your manager to approve this discount");
  }

  await clearDiscountApprovalFailures(orgId);
}

/**
 * Logs a walk-in sale (Anti-theft/POS feature, Piece 1). Price and currency
 * are read server-side from the Product catalog by productId — the request
 * only ever supplies productId + quantity. Trusting anything resembling a
 * client-sent price would defeat "price auto-fills from the catalog" as a
 * real guarantee, not just a UI convenience.
 */
export async function logSale(
  orgId: string,
  staffUserId: string,
  role: string,
  input: CreateSaleInput,
) {
  const productIds = input.items.map((item) => item.productId);
  const products = await productRepo.findManyByIds(orgId, productIds);
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) throw new NotFoundError("Product not found");
    const unitPrice = Number(product.price);
    return {
      productId: product.id,
      productName: product.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const currency = products[0]?.currency ?? "NGN";

  const requestedDiscount = input.discountAmount ?? 0;
  let discountAmount = 0;
  if (requestedDiscount > 0) {
    await verifyDiscountApproval(orgId, role, input.approvalPin);
    // Clamped, never negative-total — a discount can zero out a sale but
    // never turn it into a "refund".
    discountAmount = Math.min(requestedDiscount, subtotal);
  }

  const total = subtotal - discountAmount;

  const sale = await saleRepo.createSale(orgId, {
    staffUserId,
    total,
    discountAmount,
    currency,
    customerName: input.customerName,
    items,
  });

  if (discountAmount > 0) {
    await auditLogRepo.write({
      orgId,
      userId: staffUserId,
      action: "sale.discount_applied",
      entityType: "sale",
      entityId: sale.id,
      newValue: { subtotal, discountAmount, total, approvedByRole: role },
    });
  }

  return sale;
}

export async function listSales(orgId: string, page: PageParams) {
  return saleRepo.listByOrg(orgId, page);
}
