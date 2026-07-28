import type { Request, Response, NextFunction } from "express";
import { DomainError } from "../lib/errors";
import { logger } from "../lib/logger";

// Centralized error handler (Handbook 5.10) — maps typed domain errors to HTTP
// responses; anything else is an unexpected failure that never leaks a stack
// trace to the client, only a requestId for support correlation.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
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
