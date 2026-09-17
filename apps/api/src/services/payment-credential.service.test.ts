import { randomUUID } from "node:crypto";
import { randomBytes } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const ENCRYPTION_KEY = randomBytes(32).toString("base64");

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
  process.env.TWO_FA_ENCRYPTION_KEY_BASE64 ??= "placeholder";
});

vi.mock("../repositories/payment-credential.repository", () => ({
  upsert: vi.fn(),
  findByOrgAndProcessor: vi.fn(),
  listByOrg: vi.fn(),
  deactivate: vi.fn(),
}));
// Same reasoning as every other service test in this file — lib/env.ts's
// top-level schema parse runs before any beforeAll patching of process.env
// can take effect.
vi.mock("../lib/env", () => ({
  env: {
    PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64: undefined as string | undefined,
    PAYSTACK_SECRET_KEY: undefined as string | undefined,
  },
}));

import * as credentialRepo from "../repositories/payment-credential.repository";
import { env } from "../lib/env";
import * as credentialService from "./payment-credential.service";

describe("payment-credential.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
    env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64 = ENCRYPTION_KEY;
    env.PAYSTACK_SECRET_KEY = "platform_default_key";
  });

  describe("connect / listConnections", () => {
    it("encrypts the secret before storing it, and never returns it back", async () => {
      const credentialId = randomUUID();
      vi.mocked(credentialRepo.upsert).mockResolvedValue({
        id: credentialId,
        processor: "paystack",
        publicKey: "pk_test_123",
        isActive: true,
        updatedAt: new Date(),
      } as never);

      const result = await credentialService.connect(
        orgId,
        "paystack",
        "sk_live_real_secret",
        "pk_test_123",
      );

      const [, , storedEncrypted] = vi.mocked(credentialRepo.upsert).mock.calls[0]!;
      expect(storedEncrypted).not.toBe("sk_live_real_secret");
      expect(result).toEqual({
        id: credentialId,
        processor: "paystack",
        publicKey: "pk_test_123",
        isActive: true,
        updatedAt: expect.any(Date),
      });
      expect(result).not.toHaveProperty("secretKey");
      expect(result).not.toHaveProperty("secretKeyEncrypted");
    });

    it("throws a clear error when encryption isn't configured, before touching the repository", async () => {
      env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY_BASE64 = undefined;

      await expect(
        credentialService.connect(orgId, "paystack", "sk_live_real_secret"),
      ).rejects.toThrow(/not configured/);
      expect(credentialRepo.upsert).not.toHaveBeenCalled();
    });

    it("listConnections never exposes the encrypted secret field", async () => {
      const credentialId = randomUUID();
      vi.mocked(credentialRepo.listByOrg).mockResolvedValue([
        {
          id: credentialId,
          processor: "paystack",
          publicKey: "pk_test_123",
          isActive: true,
          updatedAt: new Date(),
          secretKeyEncrypted: "should-never-leak",
        } as never,
      ]);

      const result = await credentialService.listConnections(orgId);

      expect(result[0]).not.toHaveProperty("secretKeyEncrypted");
      expect(result[0]).toEqual({
        id: credentialId,
        processor: "paystack",
        publicKey: "pk_test_123",
        isActive: true,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("resolveSecretKey", () => {
    it("round-trips: a key connected via connect() is exactly what resolveSecretKey later decrypts", async () => {
      let stored: { secretKeyEncrypted: string; publicKey?: string } | undefined;
      vi.mocked(credentialRepo.upsert).mockImplementation(async (_orgId, processor, enc, pub) => {
        stored = { secretKeyEncrypted: enc, publicKey: pub };
        return {
          processor,
          publicKey: pub ?? null,
          isActive: true,
          updatedAt: new Date(),
        } as never;
      });
      vi.mocked(credentialRepo.findByOrgAndProcessor).mockImplementation(async () =>
        stored ? ({ secretKeyEncrypted: stored.secretKeyEncrypted } as never) : null,
      );

      await credentialService.connect(orgId, "paystack", "sk_live_real_secret");
      const resolved = await credentialService.resolveSecretKey(orgId, "paystack");

      expect(resolved).toBe("sk_live_real_secret");
    });

    it("falls back to the platform key when the org has no connected credential", async () => {
      vi.mocked(credentialRepo.findByOrgAndProcessor).mockResolvedValue(null);

      const resolved = await credentialService.resolveSecretKey(orgId, "paystack");

      expect(resolved).toBe("platform_default_key");
    });

    it("falls back to the platform key when orgId is null (webhook org not yet identified)", async () => {
      const resolved = await credentialService.resolveSecretKey(null, "paystack");

      expect(resolved).toBe("platform_default_key");
      expect(credentialRepo.findByOrgAndProcessor).not.toHaveBeenCalled();
    });

    it("returns null for a processor with no platform key and no org credential", async () => {
      vi.mocked(credentialRepo.findByOrgAndProcessor).mockResolvedValue(null);

      const resolved = await credentialService.resolveSecretKey(orgId, "stripe");

      expect(resolved).toBeNull();
    });
  });

  describe("requireSecretKey", () => {
    it("throws when no key can be resolved at all", async () => {
      vi.mocked(credentialRepo.findByOrgAndProcessor).mockResolvedValue(null);

      await expect(credentialService.requireSecretKey(orgId, "stripe")).rejects.toThrow(
        /No stripe credentials configured/,
      );
    });
  });

  describe("disconnect", () => {
    it("deactivates rather than deleting the credential row", async () => {
      await credentialService.disconnect(orgId, "paystack");

      expect(credentialRepo.deactivate).toHaveBeenCalledWith(orgId, "paystack");
    });
  });
});
