import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/payroll-export.repository", () => ({
  findByOrg: vi.fn(),
  upsert: vi.fn(),
  updateSecret: vi.fn(),
  recordDelivery: vi.fn(),
  deactivate: vi.fn(),
}));
vi.mock("../repositories/payroll-run.repository", () => ({
  findById: vi.fn(),
}));
vi.mock("../repositories/payslip.repository", () => ({
  listByRun: vi.fn(),
}));
vi.mock("../repositories/employee.repository", () => ({
  listByIds: vi.fn(),
}));
// Same reasoning as every other service test in this file — lib/env.ts's
// top-level schema parse runs before any beforeEach patching of process.env
// can take effect.
vi.mock("../lib/env", () => ({
  env: { PAYROLL_EXPORT_ENCRYPTION_KEY_BASE64: undefined as string | undefined },
}));

import * as configRepo from "../repositories/payroll-export.repository";
import * as payrollRunRepo from "../repositories/payroll-run.repository";
import * as payslipRepo from "../repositories/payslip.repository";
import * as employeeRepo from "../repositories/employee.repository";
import { env } from "../lib/env";
import * as payrollExportService from "./payroll-export.service";

const TEST_SECRET = "__TEST_WEBHOOK_SECRET__";

describe("payroll-export.service", () => {
  const orgId = randomUUID();
  const runId = randomUUID();
  const ENCRYPTION_KEY = randomBytes(32).toString("base64");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    env.PAYROLL_EXPORT_ENCRYPTION_KEY_BASE64 = ENCRYPTION_KEY;
  });

  describe("configure", () => {
    it("rejects a non-https webhook URL before touching the repository", async () => {
      await expect(
        payrollExportService.configure(orgId, "http://example.com/hook"),
      ).rejects.toThrow(/https/);
      expect(configRepo.upsert).not.toHaveBeenCalled();
    });

    it("rejects a malformed URL", async () => {
      await expect(payrollExportService.configure(orgId, "not-a-url")).rejects.toThrow(/valid URL/);
    });

    it("generates a whsec_-prefixed secret, encrypts it before storing, and returns it in plaintext once", async () => {
      vi.mocked(configRepo.upsert).mockImplementation(
        async (_orgId, webhookUrl) => ({ webhookUrl }) as never,
      );

      const result = await payrollExportService.configure(orgId, "https://example.com/hook");

      expect(result.webhookUrl).toBe("https://example.com/hook");
      expect(result.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
      const [, , storedEncrypted] = vi.mocked(configRepo.upsert).mock.calls[0]!;
      expect(storedEncrypted).not.toBe(result.secret);
    });
  });

  describe("regenerateSecret", () => {
    it("throws when no config exists yet", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue(null);
      await expect(payrollExportService.regenerateSecret(orgId)).rejects.toThrow(
        /not configured|No payroll export/,
      );
      expect(configRepo.updateSecret).not.toHaveBeenCalled();
    });

    it("mints and stores a new encrypted secret, distinct from the old one", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue({
        webhookUrl: "https://example.com/hook",
      } as never);

      const result = await payrollExportService.regenerateSecret(orgId);

      expect(result.secret).toMatch(/^whsec_/);
      expect(configRepo.updateSecret).toHaveBeenCalledWith(orgId, expect.any(String));
      const [, storedEncrypted] = vi.mocked(configRepo.updateSecret).mock.calls[0]!;
      expect(storedEncrypted).not.toBe(result.secret);
    });
  });

  describe("getConfig / disable", () => {
    it("never exposes the encrypted secret", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue({
        webhookUrl: "https://example.com/hook",
        isActive: true,
        lastDeliveryAt: null,
        lastDeliveryError: null,
        webhookSecretEncrypted: "should-never-leak",
      } as never);

      const config = await payrollExportService.getConfig(orgId);

      expect(config).not.toHaveProperty("webhookSecretEncrypted");
    });

    it("returns null when nothing is configured", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue(null);
      expect(await payrollExportService.getConfig(orgId)).toBeNull();
    });

    it("disable deactivates rather than deleting", async () => {
      await payrollExportService.disable(orgId);
      expect(configRepo.deactivate).toHaveBeenCalledWith(orgId);
    });
  });

  describe("exportRunAsCsv", () => {
    it("builds a header row plus one row per payslip, escaping commas in names", async () => {
      vi.mocked(payrollRunRepo.findById).mockResolvedValue({ periodLabel: "2026-08" } as never);
      vi.mocked(payslipRepo.listByRun).mockResolvedValue([
        {
          employeeId: "emp-1",
          grossPay: 100000,
          paye: 5000,
          employeePension: 8000,
          employerPension: 10000,
          nhf: 2500,
          netPay: 84500,
        } as never,
      ]);
      vi.mocked(employeeRepo.listByIds).mockResolvedValue([
        { id: "emp-1", name: "Doe, Jane", jobTitle: "Engineer" } as never,
      ]);

      const csv = await payrollExportService.exportRunAsCsv(orgId, runId);

      const lines = csv.trim().split("\r\n");
      expect(lines[0]).toBe(
        "Employee,Job title,Gross pay,PAYE,Employee pension,Employer pension,NHF,Net pay",
      );
      expect(lines[1]).toBe('"Doe, Jane",Engineer,100000,5000,8000,10000,2500,84500');
    });
  });

  describe("deliverPayrollRunExport", () => {
    async function encryptedSecret(secret: string) {
      const { encryptSecret } = await import("../lib/encryption");
      return encryptSecret(secret, ENCRYPTION_KEY, orgId);
    }

    it("is a no-op when no config exists", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue(null);
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await payrollExportService.deliverPayrollRunExport(orgId, runId);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("is a no-op when the config is inactive", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue({ isActive: false } as never);
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      await payrollExportService.deliverPayrollRunExport(orgId, runId);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("signs the payload with the org's own decrypted secret and records success", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue({
        webhookUrl: "https://example.com/hook",
        isActive: true,
        webhookSecretEncrypted: await encryptedSecret(TEST_SECRET),
      } as never);
      vi.mocked(payrollRunRepo.findById).mockResolvedValue({
        periodLabel: "2026-08",
        totalGrossPay: 100000,
        totalDeductions: 15500,
        totalNetPay: 84500,
      } as never);
      vi.mocked(payslipRepo.listByRun).mockResolvedValue([]);
      vi.mocked(employeeRepo.listByIds).mockResolvedValue([]);
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchSpy);

      await payrollExportService.deliverPayrollRunExport(orgId, runId);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("https://example.com/hook");
      const expectedSignature = createHmac("sha256", TEST_SECRET).update(init.body).digest("hex");
      expect(init.headers["X-Vela-Signature"]).toBe(expectedSignature);
      expect(configRepo.recordDelivery).toHaveBeenCalledWith(orgId, null);
    });

    it("records a delivery failure without throwing", async () => {
      vi.mocked(configRepo.findByOrg).mockResolvedValue({
        webhookUrl: "https://example.com/hook",
        isActive: true,
        webhookSecretEncrypted: await encryptedSecret(TEST_SECRET),
      } as never);
      vi.mocked(payrollRunRepo.findById).mockResolvedValue({
        periodLabel: "2026-08",
        totalGrossPay: 0,
        totalDeductions: 0,
        totalNetPay: 0,
      } as never);
      vi.mocked(payslipRepo.listByRun).mockResolvedValue([]);
      vi.mocked(employeeRepo.listByIds).mockResolvedValue([]);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      await expect(
        payrollExportService.deliverPayrollRunExport(orgId, runId),
      ).resolves.toBeUndefined();

      expect(configRepo.recordDelivery).toHaveBeenCalledWith(orgId, expect.stringContaining("500"));
    });
  });
});
