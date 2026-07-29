import type { BankSyncGatewayHandler } from "./types";

// Stub — proves the BankSyncGatewayHandler abstraction is provider-agnostic
// (Handbook 10.3) without needing an Okra account today. Wire this up
// exactly like mono.gateway.ts once it's prioritized — deferred per the
// Phase 4 plan's scope decision, not because the interface can't support it.
export const okraGateway: BankSyncGatewayHandler = {
  provider: "okra",

  async exchangeLinkToken() {
    throw new Error(
      "Okra is not yet configured — Mono is the primary bank-sync provider for Phase 4",
    );
  },

  async fetchBalance() {
    throw new Error(
      "Okra is not yet configured — Mono is the primary bank-sync provider for Phase 4",
    );
  },

  async fetchTransactions() {
    throw new Error(
      "Okra is not yet configured — Mono is the primary bank-sync provider for Phase 4",
    );
  },
};
