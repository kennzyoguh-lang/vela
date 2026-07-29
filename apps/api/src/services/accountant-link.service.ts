import * as accountantLinkRepo from "../repositories/accountant-link.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { ConflictError, NotFoundError } from "../lib/errors";

// Client-org side — mirrors organisation.service.ts's inviteUser/
// listPendingInvites/revokeInvite shape exactly.
export async function inviteAccountant(orgId: string, invitedBy: string, email: string) {
  const existing = await accountantLinkRepo.findByEmail(orgId, email);

  let link;
  if (existing) {
    if (existing.status !== "revoked") {
      throw new ConflictError(
        "This email already has an active or pending link to your organisation",
      );
    }
    link = await accountantLinkRepo.reinvite(orgId, existing.id, invitedBy);
  } else {
    link = await accountantLinkRepo.create(orgId, { accountantEmail: email, invitedBy });
  }

  await auditLogRepo.write({
    orgId,
    userId: invitedBy,
    action: "accountant_link.invited",
    entityType: "accountant_client_link",
    entityId: link.id,
    newValue: { email },
  });
  return link;
}

export async function listLinksForOrg(orgId: string) {
  return accountantLinkRepo.listByOrg(orgId);
}

export async function revokeLink(orgId: string, actorId: string, linkId: string) {
  const link = await accountantLinkRepo.findById(orgId, linkId);
  if (!link) throw new NotFoundError("Accountant link not found");
  await accountantLinkRepo.revoke(orgId, linkId);
  await auditLogRepo.write({
    orgId,
    userId: actorId,
    action: "accountant_link.revoked",
    entityType: "accountant_client_link",
    entityId: linkId,
  });
}
