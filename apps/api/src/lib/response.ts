import type { Response } from "express";

// Uniform response envelope — Handbook Part 7.6. Every endpoint, success or
// error, ships through these two helpers so no controller improvises a shape.
export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta: Record<string, unknown> = {},
) {
  res
    .status(status)
    .json({ success: true, data, meta: { requestId: res.locals.requestId, ...meta } });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  res.status(status).json({
    success: false,
    error: { code, message, details, requestId: res.locals.requestId },
  });
}
