import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import type { WaitlistSignup } from "@prisma/client";

// No org_id — same "global ledger, no per-tenant scope" shape as
// calculator-lead.repository.ts. Goes through the raw client directly,
// never withOrgScope.
export async function createSignup(input: {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  revenueRange: string;
  problem: string;
  segment: string;
}): Promise<WaitlistSignup> {
  return prisma.waitlistSignup.create({
    data: { id: randomUUID(), ...input },
  });
}
