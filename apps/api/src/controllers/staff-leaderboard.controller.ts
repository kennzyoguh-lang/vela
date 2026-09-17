import type { Request, Response } from "express";
import * as staffLeaderboardService from "../services/staff-leaderboard.service";
import { staffLeaderboardRangeSchema } from "../validation/staff-leaderboard.schema";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";

export async function getLeaderboard(req: Request, res: Response) {
  const { orgId } = getAuthContext(req);
  const { from, to } = staffLeaderboardRangeSchema.parse(req.query);
  const leaderboard = await staffLeaderboardService.getLeaderboard(orgId, from, to);
  sendSuccess(res, leaderboard);
}
