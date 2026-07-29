import { withOrgScope } from "../lib/prisma";
import type { PaymentActivation } from "@prisma/client";

/**
 * Records a successful Pay-Now payment against the org's activation record
 * (BRD v3.1 6.3) — `firstPaymentReceivedAt` is set only the first time this
 * ever runs for an org (a plain upsert would overwrite it on every payment,
 * losing the "first" semantics), every call after that just accumulates volume.
 */
export async function recordPayment(
  orgId: string,
  channel: string,
  volumeToAdd: number,
): Promise<PaymentActivation> {
  return withOrgScope(orgId, async (tx) => {
    const existing = await tx.paymentActivation.findUnique({ where: { orgId } });
    if (!existing) {
      return tx.paymentActivation.create({
        data: {
          orgId,
          payNowEnabledAt: new Date(),
          firstPaymentReceivedAt: new Date(),
          activationChannel: channel,
          cumulativeVolumeNgn: volumeToAdd,
        },
      });
    }
    return tx.paymentActivation.update({
      where: { orgId },
      data: { cumulativeVolumeNgn: { increment: volumeToAdd } },
    });
  });
}

export async function getForOrg(orgId: string): Promise<PaymentActivation | null> {
  return withOrgScope(orgId, (tx) => tx.paymentActivation.findUnique({ where: { orgId } }));
}
