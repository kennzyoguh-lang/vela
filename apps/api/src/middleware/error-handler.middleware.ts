import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { DomainError } from "../lib/errors";
import { logger } from "../lib/logger";

// Centralized error handler (Handbook 5.10) — maps typed domain errors to HTTP
// responses; anything else is an unexpected failure that never leaks a stack
// trace to the client, only a requestId for support correlation.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Every controller validates its input with a zod `.parse()` call
  // (Handbook 5.x) — without this branch, a plain ZodError isn't a
  // DomainError instance, so bad input on ANY endpoint fell through to the
  // generic 500 below instead of a proper 400 with field-level messages.
  if (err instanceof ZodError) {
    const fields = err.issues.map((issue) => ({
      field: issue.path.join(".") || undefined,
      message: issue.message,
    }));
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: fields[0]?.message ?? "Invalid request",
        field: fields[0]?.field,
        fields,
        requestId: res.locals.requestId,
      },
    });
  }

  if (err instanceof DomainError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof Error && "field" in err
          ? { field: (err as { field?: string }).field }
          : {}),
        requestId: res.locals.requestId,
      },
    });
  }

  logger.error({ err, requestId: res.locals.requestId }, "Unhandled error");
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Please try again.",
      requestId: res.locals.requestId,
    },
  });
}
