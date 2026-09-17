import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../repositories/branch.repository", () => ({
  create: vi.fn(),
  findById: vi.fn(),
  listActiveByOrg: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  assignStaff: vi.fn(),
}));
vi.mock("../repositories/user.repository", () => ({
  findById: vi.fn(),
}));

import * as branchRepo from "../repositories/branch.repository";
import * as userRepo from "../repositories/user.repository";
import * as branchService from "./branch.service";

describe("branch.service", () => {
  const orgId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a branch by delegating straight to the repository", async () => {
    const input = { name: "Ikeja shop", address: "12 Allen Ave" };
    vi.mocked(branchRepo.create).mockResolvedValue({ id: randomUUID(), ...input } as never);

    await branchService.createBranch(orgId, input);

    expect(branchRepo.create).toHaveBeenCalledWith(orgId, input);
  });

  it("throws NotFoundError for an unknown branch id", async () => {
    vi.mocked(branchRepo.findById).mockResolvedValue(null);

    await expect(branchService.getBranch(orgId, randomUUID())).rejects.toThrow(/not found/i);
  });

  it("404s before attempting an update on a missing branch", async () => {
    vi.mocked(branchRepo.findById).mockResolvedValue(null);

    await expect(
      branchService.updateBranch(orgId, randomUUID(), { name: "New name" }),
    ).rejects.toThrow(/not found/i);
    expect(branchRepo.update).not.toHaveBeenCalled();
  });

  it("deactivates an existing branch", async () => {
    const branchId = randomUUID();
    vi.mocked(branchRepo.findById).mockResolvedValue({ id: branchId } as never);
    vi.mocked(branchRepo.deactivate).mockResolvedValue({
      id: branchId,
      isActive: false,
    } as never);

    await branchService.deactivateBranch(orgId, branchId);

    expect(branchRepo.deactivate).toHaveBeenCalledWith(orgId, branchId);
  });

  it("assigns a staff member to a branch after verifying both exist in the org", async () => {
    const userId = randomUUID();
    const branchId = randomUUID();
    vi.mocked(userRepo.findById).mockResolvedValue({ id: userId } as never);
    vi.mocked(branchRepo.findById).mockResolvedValue({ id: branchId } as never);

    await branchService.assignStaffToBranch(orgId, userId, branchId);

    expect(branchRepo.assignStaff).toHaveBeenCalledWith(orgId, userId, branchId);
  });

  it("unassigns a staff member from any branch when branchId is null", async () => {
    const userId = randomUUID();
    vi.mocked(userRepo.findById).mockResolvedValue({ id: userId } as never);

    await branchService.assignStaffToBranch(orgId, userId, null);

    expect(branchRepo.findById).not.toHaveBeenCalled();
    expect(branchRepo.assignStaff).toHaveBeenCalledWith(orgId, userId, null);
  });

  it("throws NotFoundError when assigning an unknown staff member", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);

    await expect(
      branchService.assignStaffToBranch(orgId, randomUUID(), randomUUID()),
    ).rejects.toThrow(/not found/i);
    expect(branchRepo.assignStaff).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when assigning to a cross-org/missing branch", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue({ id: randomUUID() } as never);
    vi.mocked(branchRepo.findById).mockResolvedValue(null);

    await expect(
      branchService.assignStaffToBranch(orgId, randomUUID(), randomUUID()),
    ).rejects.toThrow(/not found/i);
    expect(branchRepo.assignStaff).not.toHaveBeenCalled();
  });
});
