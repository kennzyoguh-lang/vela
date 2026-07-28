import type { Request, Response, NextFunction } from "express";
import { InsufficientPermissionError } from "../lib/errors";
import type { Role } from "@prisma/client";

// Checked against the route's required permission BEFORE the controller runs
// (Handbook 5.5), not inside it. F-69's five roles: Owner, Admin, Accountant,
// Staff, View-only.
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.role || !allowed.includes(req.role as Role)) {
      return next(new InsufficientPermissionError());
    }
    next();
  };
}
