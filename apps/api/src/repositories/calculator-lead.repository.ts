import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import type { CalculatorLead } from "@prisma/client";

// No org_id — an anonymous marketing-site visitor has no org yet, same
// "global ledger, no per-tenant scope" shape as webhook-event.repository.ts.
// Goes through the raw client directly, never withOrgScope.
export async function createLead(input: {
  email: string;
  businessName: string;
  vatPenalty: number;
  whtPenalty: number;
  citPenalty: number;
  totalPenalty: number;
}): Promise<CalculatorLead> {
  return prisma.calculatorLead.create({
    data: {
      id: randomUUID(),
      email: input.email,
      businessName: input.businessName,
      vatPenalty: input.vatPenalty,
      whtPenalty: input.whtPenalty,
      citPenalty: input.citPenalty,
      totalPenalty: input.totalPenalty,
    },
  });
}

export async function markConverted(email: string): Promise<void> {
  await prisma.calculatorLead.updateMany({
    where: { email, convertedToAccount: false },
    data: { convertedToAccount: true },
  });
}
