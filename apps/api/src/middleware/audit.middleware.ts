import type { Request, Response, NextFunction } from "express";
import * as auditLogRepo from "../repositories/audit-log.repository";
import { logger } from "../lib/logger";

/**
 * Auto-logs every mutating request (Handbook 5.7) — services never have to
 * remember to call an audit function themselves. 5.7.1: an audit write failure
 * must never fail silently — if the write fails, the triggering request itself
 * fails with a 500, because an unaudited mutation didn't happen as far as
 * SOC 2/NDPR compliance is concerned. This is "fail loud" deliberately
 * overriding "fail safe" (Handbook 1.4).
 */
export function auditLog(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 400 || !req.orgId) return originalJson(body);

      const entityId =
        body && typeof body === "object" && "data" in body
          ? (body as { data?: { id?: string } }).data?.id
          : undefined;

      auditLogRepo
        .write({
          orgId: req.orgId,
          userId: req.userId,
          action,
          entityType,
          entityId,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        })
        .then(() => originalJson(body))
        .catch((err: unknown) => {
          logger.error({ err, action, entityType }, "audit_log write failed — failing request");
          res.status(500).json({
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "This action could not be completed. Please try again.",
              requestId: res.locals.requestId,
            },
          });
        });
      return res;
    }) as typeof res.json;
    next();
  };
}
