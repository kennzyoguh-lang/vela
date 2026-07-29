import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import type { PaymentProcessor } from "@prisma/client";

/**
 * Idempotency ledger (Handbook 5.9) — no org_id (a webhook arrives before any
 * org context is known), so this goes through the raw client directly, never
 * withOrgScope. Returns false if the event was already processed (the
 * `@@unique([processor, providerEventId])` constraint is what actually
 * enforces this atomically under concurrent delivery — this function's
 * try/catch on the unique-violation is the real guarantee, not a
 * check-then-insert race).
 */
export async function recordIfNew(
  processor: PaymentProcessor,
  providerEventId: string,
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { id: randomUUID(), processor, providerEventId } });
    return true;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return false; // unique constraint violation — already processed
    }
    throw err;
  }
}
