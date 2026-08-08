import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../repositories/user.repository", () => ({
  findById: vi.fn(),
}));

import * as userRepo from "../repositories/user.repository";
import { requireVerifiedEmail } from "./email-verification.middleware";
import { EmailNotVerifiedError, NotFoundError } from "../lib/errors";

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("email-verification.middleware#requireVerifiedEmail", () => {
  beforeEach(() => {
    vi.mocked(userRepo.findById).mockReset();
  });

  it("calls next() with no error when the user's email is verified", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue({
      id: "user-1",
      orgId: "org-1",
      emailVerifiedAt: new Date(),
    } as never);
    const next = vi.fn();
    const req = { orgId: "org-1", userId: "user-1" } as unknown as Request;

    requireVerifiedEmail(req, {} as Response, next);
    await flush();

    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(EmailNotVerifiedError) when emailVerifiedAt is null", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue({
      id: "user-1",
      orgId: "org-1",
      emailVerifiedAt: null,
    } as never);
    const next = vi.fn();
    const req = { orgId: "org-1", userId: "user-1" } as unknown as Request;

    requireVerifiedEmail(req, {} as Response, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.any(EmailNotVerifiedError));
  });

  it("calls next(NotFoundError) when the user no longer exists", async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null);
    const next = vi.fn();
    const req = { orgId: "org-1", userId: "user-1" } as unknown as Request;

    requireVerifiedEmail(req, {} as Response, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
