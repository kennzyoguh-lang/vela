import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../services/rate-limit.service", () => ({
  checkAndIncrement: vi.fn(),
}));

import { checkAndIncrement } from "../services/rate-limit.service";
import { emailVerifyRateLimit, resendVerificationRateLimit } from "./rate-limit.middleware";
import { RateLimitedError } from "../lib/errors";

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("rate-limit.middleware", () => {
  beforeEach(() => {
    vi.mocked(checkAndIncrement).mockReset();
  });

  describe("emailVerifyRateLimit", () => {
    it("calls next() when under the per-IP limit", async () => {
      vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, remaining: 5 });
      const next = vi.fn();
      const req = { ip: "1.2.3.4" } as Request;

      emailVerifyRateLimit()(req, {} as Response, next);
      await flush();

      expect(next).toHaveBeenCalledWith();
    });

    it("calls next(RateLimitedError) once the per-IP limit is exceeded", async () => {
      vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: false, remaining: 0 });
      const next = vi.fn();
      const req = { ip: "1.2.3.4" } as Request;

      emailVerifyRateLimit()(req, {} as Response, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.any(RateLimitedError));
    });
  });

  describe("resendVerificationRateLimit", () => {
    it("keys the limit per-user, not per-IP", async () => {
      vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: true, remaining: 2 });
      const next = vi.fn();
      const req = { userId: "user-1", ip: "1.2.3.4" } as unknown as Request;

      resendVerificationRateLimit()(req, {} as Response, next);
      await flush();

      expect(checkAndIncrement).toHaveBeenCalledWith(expect.stringContaining("user-1"), 3, 60);
      expect(next).toHaveBeenCalledWith();
    });

    it("calls next(RateLimitedError) once the per-user limit is exceeded", async () => {
      vi.mocked(checkAndIncrement).mockResolvedValue({ allowed: false, remaining: 0 });
      const next = vi.fn();
      const req = { userId: "user-1", ip: "1.2.3.4" } as unknown as Request;

      resendVerificationRateLimit()(req, {} as Response, next);
      await flush();

      expect(next).toHaveBeenCalledWith(expect.any(RateLimitedError));
    });
  });
});
