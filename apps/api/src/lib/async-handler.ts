import type { Request, Response, NextFunction, RequestHandler } from "express";

// Express doesn't forward rejected promises to error middleware on its own;
// every async controller is wrapped so a thrown DomainError (or anything else)
// reaches errorHandler instead of crashing the process or hanging the request.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
