import { randomUUID, randomBytes, generateKeyPairSync } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Real RSA keypair + real ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64, same
// reasoning as jwt.service.test.ts — this file exercises the real
// sign/verify (OAuth state) and real encrypt/decrypt (token storage) round
// trips rather than mocking either, since those two round trips are exactly
// what would silently break if this service's aad()/key handling ever
// drifted from what it writes vs. what it later reads back.
beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString("base64");
  process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString("base64");
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= "placeholder";
  process.env.ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString("base64");
});

vi.mock("../repositories/accounting-connection.repository", () => ({
  upsert: vi.fn(),
  findByOrgAndProvider: vi.fn(),
  listByOrg: vi.fn(),
  listAllActiveRefs: vi.fn(),
  updateTokens: vi.fn(),
  recordSyncResult: vi.fn(),
  deactivate: vi.fn(),
}));
vi.mock("../repositories/invoice-accounting-sync.repository", () => ({
  findByInvoiceAndProvider: vi.fn(),
  record: vi.fn(),
  listPushableInvoices: vi.fn(),
}));
vi.mock("../repositories/audit-log.repository", () => ({
  write: vi.fn(),
}));
vi.mock("./accounting-gateways", () => ({
  getAccountingGateway: vi.fn(),
}));

import * as connectionRepo from "../repositories/accounting-connection.repository";
import * as syncRepo from "../repositories/invoice-accounting-sync.repository";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { getAccountingGateway } from "./accounting-gateways";

function stubGateway(overrides: Record<string, unknown> = {}) {
  return {
    provider: "quickbooks",
    isConfigured: vi.fn(() => true),
    buildAuthorizeUrl: vi.fn(
      (state: string) => `https://provider.example/authorize?state=${state}`,
    ),
    exchangeCodeForTokens: vi.fn(),
    refreshAccessToken: vi.fn(),
    pushInvoice: vi.fn(),
    ...overrides,
  };
}

describe("accounting-connection.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuthorizeUrl / handleCallback", () => {
    it("round-trips: the state signed for getAuthorizeUrl is exactly what handleCallback accepts", async () => {
      const gateway = stubGateway();
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { getAuthorizeUrl, handleCallback } = await import("./accounting-connection.service");

      const url = getAuthorizeUrl(orgId, "quickbooks");
      const state = new URL(url).searchParams.get("state")!;

      const savedId = randomUUID();
      vi.mocked(gateway.exchangeCodeForTokens).mockResolvedValue({
        accessToken: "real-access-token",
        refreshToken: "real-refresh-token",
        expiresAt: new Date(Date.now() + 3600_000),
        externalTenantId: "realm-123",
      });
      vi.mocked(connectionRepo.upsert).mockImplementation(async () => ({ id: savedId }) as never);

      const result = await handleCallback("quickbooks", "auth-code", state, {
        realmId: "realm-123",
      });

      expect(result).toEqual({ orgId });
      const [, , upsertInput] = vi.mocked(connectionRepo.upsert).mock.calls[0]!;
      expect(upsertInput.accessTokenEncrypted).not.toBe("real-access-token");
      expect(upsertInput.externalTenantId).toBe("realm-123");
      expect(auditLogRepo.write).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId,
          action: "accounting_connection.connect",
          entityId: savedId,
        }),
      );
    });

    it("rejects a state signed for a different provider than the callback claims", async () => {
      const gateway = stubGateway();
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { getAuthorizeUrl, handleCallback } = await import("./accounting-connection.service");

      const url = getAuthorizeUrl(orgId, "quickbooks");
      const state = new URL(url).searchParams.get("state")!;

      await expect(handleCallback("xero", "auth-code", state, {})).rejects.toThrow(
        /does not match/,
      );
      expect(gateway.exchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it("refuses to start a connection for a provider that isn't configured", async () => {
      vi.mocked(getAccountingGateway).mockReturnValue(
        stubGateway({ isConfigured: vi.fn(() => false) }) as never,
      );
      const { getAuthorizeUrl } = await import("./accounting-connection.service");

      expect(() => getAuthorizeUrl(orgId, "xero")).toThrow(/not available/);
    });
  });

  describe("listConnections / disconnect", () => {
    it("never exposes any token field", async () => {
      vi.mocked(connectionRepo.listByOrg).mockResolvedValue([
        {
          id: "conn-1",
          provider: "quickbooks",
          isActive: true,
          lastSyncedAt: null,
          lastSyncError: null,
          createdAt: new Date(),
          accessTokenEncrypted: "should-never-leak",
          refreshTokenEncrypted: "should-never-leak",
        } as never,
      ]);
      const { listConnections } = await import("./accounting-connection.service");

      const result = await listConnections(orgId);

      expect(result[0]).not.toHaveProperty("accessTokenEncrypted");
      expect(result[0]).not.toHaveProperty("refreshTokenEncrypted");
    });

    it("disconnect deactivates rather than deleting", async () => {
      const { disconnect } = await import("./accounting-connection.service");
      await disconnect(orgId, "quickbooks");
      expect(connectionRepo.deactivate).toHaveBeenCalledWith(orgId, "quickbooks");
    });
  });

  describe("pushPendingInvoices", () => {
    async function encryptedTokens(provider: "quickbooks" | "xero" | "wave") {
      const { encryptSecret } = await import("../lib/encryption");
      const key = process.env.ACCOUNTING_TOKEN_ENCRYPTION_KEY_BASE64!;
      const aad = `${orgId}:${provider}`;
      return {
        accessTokenEncrypted: encryptSecret("stored-access-token", key, aad),
        refreshTokenEncrypted: encryptSecret("stored-refresh-token", key, aad),
      };
    }

    it("returns 0 without touching the gateway when there is no connection", async () => {
      vi.mocked(connectionRepo.findByOrgAndProvider).mockResolvedValue(null);
      const gateway = stubGateway();
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { pushPendingInvoices } = await import("./accounting-connection.service");

      const count = await pushPendingInvoices(orgId, "quickbooks");

      expect(count).toBe(0);
      expect(gateway.pushInvoice).not.toHaveBeenCalled();
    });

    it("uses the stored access token as-is when it isn't near expiry, and pushes every pending invoice", async () => {
      const tokens = await encryptedTokens("quickbooks");
      vi.mocked(connectionRepo.findByOrgAndProvider).mockResolvedValue({
        id: "conn-1",
        externalTenantId: "realm-123",
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        ...tokens,
      } as never);
      vi.mocked(syncRepo.listPushableInvoices).mockResolvedValue([
        {
          id: "inv-1",
          number: "INV-0001",
          total: 5000,
          currency: "NGN",
          dueDate: new Date(),
          createdAt: new Date(),
          lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 5000 }],
          client: { name: "Acme Ltd", email: "acme@example.com" },
        } as never,
      ]);
      const gateway = stubGateway();
      vi.mocked(gateway.pushInvoice).mockResolvedValue("qbo-invoice-1");
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { pushPendingInvoices } = await import("./accounting-connection.service");

      const count = await pushPendingInvoices(orgId, "quickbooks");

      expect(count).toBe(1);
      expect(gateway.refreshAccessToken).not.toHaveBeenCalled();
      expect(gateway.pushInvoice).toHaveBeenCalledWith(
        { accessToken: "stored-access-token", externalTenantId: "realm-123" },
        expect.objectContaining({ number: "INV-0001", clientName: "Acme Ltd" }),
      );
      expect(syncRepo.record).toHaveBeenCalledWith(orgId, "inv-1", "quickbooks", "qbo-invoice-1");
      expect(connectionRepo.recordSyncResult).toHaveBeenCalledWith("conn-1", orgId, null);
    });

    it("refreshes and persists a new token pair when the stored one is at/near expiry", async () => {
      const tokens = await encryptedTokens("quickbooks");
      vi.mocked(connectionRepo.findByOrgAndProvider).mockResolvedValue({
        id: "conn-1",
        externalTenantId: "realm-123",
        tokenExpiresAt: new Date(Date.now() - 1000), // already expired
        ...tokens,
      } as never);
      vi.mocked(syncRepo.listPushableInvoices).mockResolvedValue([]);
      const gateway = stubGateway();
      vi.mocked(gateway.refreshAccessToken).mockResolvedValue({
        accessToken: "fresh-access-token",
        refreshToken: "fresh-refresh-token",
        expiresAt: new Date(Date.now() + 3600_000),
      });
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { pushPendingInvoices } = await import("./accounting-connection.service");

      await pushPendingInvoices(orgId, "quickbooks");

      expect(gateway.refreshAccessToken).toHaveBeenCalledWith("stored-refresh-token");
      const [, , newAccessEncrypted] = vi.mocked(connectionRepo.updateTokens).mock.calls[0]!;
      expect(newAccessEncrypted).not.toBe("fresh-access-token"); // stored encrypted, not plaintext
    });

    it("one invoice failing doesn't stop the rest of the batch", async () => {
      const tokens = await encryptedTokens("quickbooks");
      vi.mocked(connectionRepo.findByOrgAndProvider).mockResolvedValue({
        id: "conn-1",
        externalTenantId: "realm-123",
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        ...tokens,
      } as never);
      vi.mocked(syncRepo.listPushableInvoices).mockResolvedValue([
        {
          id: "inv-fail",
          number: "INV-0001",
          total: 1000,
          currency: "NGN",
          dueDate: new Date(),
          createdAt: new Date(),
          lineItems: [],
          client: null,
        } as never,
        {
          id: "inv-ok",
          number: "INV-0002",
          total: 2000,
          currency: "NGN",
          dueDate: new Date(),
          createdAt: new Date(),
          lineItems: [],
          client: null,
        } as never,
      ]);
      const gateway = stubGateway();
      vi.mocked(gateway.pushInvoice)
        .mockRejectedValueOnce(new Error("provider rejected this invoice"))
        .mockResolvedValueOnce("qbo-invoice-2");
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { pushPendingInvoices } = await import("./accounting-connection.service");

      const count = await pushPendingInvoices(orgId, "quickbooks");

      expect(count).toBe(1);
      expect(gateway.pushInvoice).toHaveBeenCalledTimes(2);
      expect(syncRepo.record).toHaveBeenCalledTimes(1);
      expect(connectionRepo.recordSyncResult).toHaveBeenCalledWith("conn-1", orgId, null);
    });

    it("records a connection-level failure (e.g. refresh failing) without throwing", async () => {
      const tokens = await encryptedTokens("quickbooks");
      vi.mocked(connectionRepo.findByOrgAndProvider).mockResolvedValue({
        id: "conn-1",
        externalTenantId: "realm-123",
        tokenExpiresAt: new Date(Date.now() - 1000),
        ...tokens,
      } as never);
      const gateway = stubGateway();
      vi.mocked(gateway.refreshAccessToken).mockRejectedValue(new Error("refresh_token revoked"));
      vi.mocked(getAccountingGateway).mockReturnValue(gateway as never);
      const { pushPendingInvoices } = await import("./accounting-connection.service");

      const count = await pushPendingInvoices(orgId, "quickbooks");

      expect(count).toBe(0);
      expect(connectionRepo.recordSyncResult).toHaveBeenCalledWith(
        "conn-1",
        orgId,
        expect.stringContaining("refresh_token revoked"),
      );
    });
  });
});
