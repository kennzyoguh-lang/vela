import type { AccountingGatewayHandler } from "./types";

// Wave closed its public GraphQL API to new third-party integrations in
// 2023 — there is no OAuth app registration process left to build a
// connector against, unlike QuickBooks/Xero. Kept as a named provider
// (rather than removed) so the settings UI can tell a business honestly
// "Wave isn't connectable right now" instead of silently pretending it was
// never requested; every method here is a hard stub for that reason, not
// an oversight.
export const waveGateway: AccountingGatewayHandler = {
  provider: "wave",

  isConfigured(): boolean {
    return false;
  },

  buildAuthorizeUrl(): string {
    throw new Error("Wave does not currently offer a third-party integration API");
  },

  async exchangeCodeForTokens(): Promise<never> {
    throw new Error("Wave does not currently offer a third-party integration API");
  },

  async refreshAccessToken(): Promise<never> {
    throw new Error("Wave does not currently offer a third-party integration API");
  },

  async pushInvoice(): Promise<never> {
    throw new Error("Wave does not currently offer a third-party integration API");
  },
};
