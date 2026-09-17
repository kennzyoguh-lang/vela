import * as expenseClaimRepo from "../repositories/expense-claim.repository";
import * as storedFileRepo from "../repositories/stored-file.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";
import type { CreateExpenseClaimInput } from "../repositories/expense-claim.repository";
import type { PageParams } from "../lib/pagination";

// Which categories are valid for a claim is enforced at the validation
// layer (expense-claim.schema.ts's own allowlist), not here — this
// service trusts whatever category it's given has already been checked.
export async function submitClaim(orgId: string, input: CreateExpenseClaimInput) {
  if (input.receiptFileId) {
    // Confirms the receipt actually belongs to this org (and exists at
    // all) before attaching it — same "resolve, then trust" discipline as
    // every cross-reference in this codebase, not just an FK-will-catch-it
    // afterthought, since a wrong id here would otherwise surface as an
    // opaque foreign-key violation instead of a clear error.
    const file = await storedFileRepo.findById(orgId, input.receiptFileId);
    if (!file) throw new NotFoundError("Receipt file not found");
  }

  const claim = await expenseClaimRepo.create(orgId, input);

  await auditLogRepo.write({
    orgId,
    userId: input.submittedByUserId,
    action: "expense_claim.submitted",
    entityType: "expense_claim",
    entityId: claim.id,
    newValue: { category: input.category, vendor: input.vendor, amount: input.amount },
  });

  return claim;
}

export async function listAllClaims(orgId: string, page: PageParams) {
  return expenseClaimRepo.listAllByOrg(orgId, page);
}

export async function listMyClaims(orgId: string, userId: string, page: PageParams) {
  return expenseClaimRepo.listBySubmitter(orgId, userId, page);
}

async function getReviewableClaim(orgId: string, claimId: string) {
  const claim = await expenseClaimRepo.findById(orgId, claimId);
  if (!claim) throw new NotFoundError("Expense claim not found");
  if (claim.status !== "pending") {
    throw new BusinessRuleViolationError(`This claim has already been ${claim.status}`);
  }
  return claim;
}

export async function approveClaim(orgId: string, claimId: string, reviewerId: string) {
  await getReviewableClaim(orgId, claimId);
  const claim = await expenseClaimRepo.review(orgId, claimId, "approved", reviewerId);

  await auditLogRepo.write({
    orgId,
    userId: reviewerId,
    action: "expense_claim.approved",
    entityType: "expense_claim",
    entityId: claimId,
  });

  return claim;
}

export async function rejectClaim(
  orgId: string,
  claimId: string,
  reviewerId: string,
  reason: string,
) {
  await getReviewableClaim(orgId, claimId);
  const claim = await expenseClaimRepo.review(orgId, claimId, "rejected", reviewerId, reason);

  await auditLogRepo.write({
    orgId,
    userId: reviewerId,
    action: "expense_claim.rejected",
    entityType: "expense_claim",
    entityId: claimId,
    newValue: { reason },
  });

  return claim;
}
