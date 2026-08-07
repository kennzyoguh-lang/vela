import type { Request, Response } from "express";
import * as waitlistService from "../services/waitlist.service";
import { joinWaitlistSchema } from "../validation/waitlist.schema";
import { sendSuccess } from "../lib/response";

// No auth context — public, unauthenticated waitlist join (see public.routes.ts).
export async function join(req: Request, res: Response) {
  const input = joinWaitlistSchema.parse(req.body);
  await waitlistService.join(input);
  sendSuccess(res, { joined: true }, 201);
}
