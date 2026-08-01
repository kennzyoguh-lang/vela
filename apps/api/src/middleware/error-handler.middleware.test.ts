import { describe, it, expect, vi } from "vitest";
import { ZodError, z } from "zod";
import type { Request, Response } from "express";
import { errorHandler } from "./error-handler.middleware";
import { NotFoundError, BusinessRuleViolationError } from "../lib/errors";

function mockRes() {
  const res = {
    locals: { requestId: "req_test" },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe("error-handler.middleware#errorHandler", () => {
  it("maps a ZodError to a 400 with the first issue's message and field", () => {
    const schema = z.object({ email: z.string().email() });
    const parseResult = schema.safeParse({ email: "not-an-email" });
    expect(parseResult.success).toBe(false);
    const zodError = (parseResult as { error: ZodError }).error;

    const res = mockRes();
    errorHandler(zodError, {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          field: "email",
          requestId: "req_test",
        }),
      }),
    );
  });

  it("includes every field in a multi-field ZodError, not just the first", () => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(10) });
    const parseResult = schema.safeParse({ email: "bad", password: "short" });
    const zodError = (parseResult as { success: false; error: ZodError }).error;

    const res = mockRes();
    errorHandler(zodError, {} as Request, res, vi.fn());

    const call = vi.mocked(res.json).mock.calls[0]?.[0] as { error: { fields: unknown[] } };
    expect(call.error.fields).toHaveLength(2);
  });

  it("maps a DomainError subclass to its own status and code", () => {
    const res = mockRes();
    errorHandler(new NotFoundError("Invoice not found"), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "NOT_FOUND", message: "Invoice not found" }),
      }),
    );
  });

  it("maps a BusinessRuleViolationError to 422", () => {
    const res = mockRes();
    errorHandler(new BusinessRuleViolationError("Unknown module"), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it("maps an unrecognized error to a generic 500 without leaking its message", () => {
    const res = mockRes();
    errorHandler(new Error("some internal driver detail"), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const call = vi.mocked(res.json).mock.calls[0]?.[0] as { error: { message: string } };
    expect(call.error.message).not.toContain("internal driver detail");
  });
});
