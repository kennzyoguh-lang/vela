import type { Request, Response } from "express";
import * as staffAuthService from "../services/staff-auth.service";
import { phoneLoginSchema } from "../validation/auth.schema";
import { setRefreshCookie } from "../lib/session-cookies";
import { sendSuccess } from "../lib/response";

export async function login(req: Request, res: Response) {
  const input = phoneLoginSchema.parse(req.body);
  const result = await staffAuthService.loginWithPin(input, {
    deviceInfo: req.headers["user-agent"],
    ipAddress: req.ip,
  });
  setRefreshCookie(res, result.orgId, result.sessionFamilyId, result.refreshToken);
  req.orgId = result.orgId;
  req.userId = result.userId;
  sendSuccess(res, { accessToken: result.accessToken });
}
