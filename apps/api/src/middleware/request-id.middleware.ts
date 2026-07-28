import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// requestId is always present in the response envelope and correlates directly
// to the structured log entry for that request (Handbook 7.6/11.4) — this is
// what turns "a customer says X failed" into a log lookup, not a guessing game.
export function requestId(req: Request, res: Response, next: NextFunction) {
  res.locals.requestId = `req_${randomUUID()}`;
  next();
}
