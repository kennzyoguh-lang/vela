import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.APP_DATABASE_URL ??= "postgresql://vela:vela@localhost:5432/vela_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_PRIVATE_KEY_BASE64 ??= "placeholder";
  process.env.JWT_PUBLIC_KEY_BASE64 ??= "placeholder";
});

vi.mock("../repositories/employee.repository", () => ({
  listActiveByOrg: vi.fn(),
}));
vi.mock("../repositories/payroll-run.repository", () => ({
  findByPeriod: vi.fn(),
  findById: vi.fn(),
  saveRun: vi.fn(),
  markPaid: vi.fn(),
}));
vi.mock("../repositories/payslip.repository", () => ({
  listByRun: vi.fn(),
}));

import * as employeeRepo from "../repositories/employee.repository";
import * as payrollRunRepo from "../repositories/payroll-run.repository";
import * as payrollService from "./payroll.service";
import { calculateMonthlyPaye } from "./paye-calculator";

const orgId = randomUUID();

function employeeStub(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    orgId,
    name: "Test Employee",
    email: null,
    jobTitle: "Engineer",
    employmentType: "full_time",
    basicSalary: 200_000,
    housingAllowance: 50_000,
    transportAllowance: 30_000,
    otherAllowances: 0,
    annualRentPaid: 0,
    startDate: new Date("2026-01-01"),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("payroll.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runPayroll", () => {
    it("computes pension (8% employee / 10% employer) and NHF (2.5% of basic) on the pensionable/basic amounts", async () => {
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([employeeStub()] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue(null);
      vi.mocked(payrollRunRepo.saveRun).mockResolvedValue({ id: randomUUID() } as never);

      await payrollService.runPayroll(orgId, "2026-07");

      const [, , payslips] = vi.mocked(payrollRunRepo.saveRun).mock.calls[0]!;
      const payslip = payslips[0]!;

      const pensionable = 200_000 + 50_000 + 30_000;
      expect(payslip.employeePension).toBeCloseTo(pensionable * 0.08);
      expect(payslip.employerPension).toBeCloseTo(pensionable * 0.1);
      expect(payslip.nhf).toBeCloseTo(200_000 * 0.025);
    });

    it("computes net pay as gross minus PAYE, employee pension, and NHF — nothing else", async () => {
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([employeeStub()] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue(null);
      vi.mocked(payrollRunRepo.saveRun).mockResolvedValue({ id: randomUUID() } as never);

      await payrollService.runPayroll(orgId, "2026-07");

      const [, , payslips] = vi.mocked(payrollRunRepo.saveRun).mock.calls[0]!;
      const payslip = payslips[0]!;

      expect(payslip.netPay).toBeCloseTo(
        payslip.grossPay - payslip.paye - payslip.employeePension - payslip.nhf,
      );
    });

    it("computes PAYE with pension and NHF as tax-deductible reliefs, matching the calculator directly", async () => {
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([employeeStub()] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue(null);
      vi.mocked(payrollRunRepo.saveRun).mockResolvedValue({ id: randomUUID() } as never);

      await payrollService.runPayroll(orgId, "2026-07");

      const [, , payslips] = vi.mocked(payrollRunRepo.saveRun).mock.calls[0]!;
      const payslip = payslips[0]!;

      const expectedPaye = calculateMonthlyPaye(
        payslip.grossPay,
        payslip.employeePension + payslip.nhf,
      );
      expect(payslip.paye).toBeCloseTo(expectedPaye);
    });

    it("reduces PAYE for an employee who has declared annual rent paid (NTA 2025 rent relief)", async () => {
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([
        employeeStub({ annualRentPaid: 2_400_000 }),
      ] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue(null);
      vi.mocked(payrollRunRepo.saveRun).mockResolvedValue({ id: randomUUID() } as never);

      await payrollService.runPayroll(orgId, "2026-07");
      const [, , payslips] = vi.mocked(payrollRunRepo.saveRun).mock.calls[0]!;
      const withRent = payslips[0]!;

      vi.clearAllMocks();
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([
        employeeStub({ annualRentPaid: 0 }),
      ] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue(null);
      vi.mocked(payrollRunRepo.saveRun).mockResolvedValue({ id: randomUUID() } as never);

      await payrollService.runPayroll(orgId, "2026-07");
      const [, , noRentPayslips] = vi.mocked(payrollRunRepo.saveRun).mock.calls[0]!;
      const withoutRent = noRentPayslips[0]!;

      expect(withRent.paye).toBeLessThan(withoutRent.paye);
      expect(withRent.netPay).toBeGreaterThan(withoutRent.netPay);
    });

    it("recomputes a still-draft run for the same period rather than refusing", async () => {
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([employeeStub()] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue({
        id: randomUUID(),
        status: "draft",
      } as never);
      vi.mocked(payrollRunRepo.saveRun).mockResolvedValue({ id: randomUUID() } as never);

      await expect(payrollService.runPayroll(orgId, "2026-07")).resolves.toBeDefined();
      expect(payrollRunRepo.saveRun).toHaveBeenCalledTimes(1);
    });

    it("refuses to recompute a run already marked paid", async () => {
      vi.mocked(employeeRepo.listActiveByOrg).mockResolvedValue([employeeStub()] as never);
      vi.mocked(payrollRunRepo.findByPeriod).mockResolvedValue({
        id: randomUUID(),
        status: "paid",
      } as never);

      await expect(payrollService.runPayroll(orgId, "2026-07")).rejects.toThrow(
        /already marked paid/,
      );
      expect(payrollRunRepo.saveRun).not.toHaveBeenCalled();
    });
  });
});
