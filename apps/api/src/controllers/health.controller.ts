import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

// GET /health — liveness (is the process running). GET /ready — readiness (can
// it actually serve traffic). The load balancer only routes to instances
// passing /ready (Handbook 11.5), so a DB/Redis blip removes an instance from
// rotation automatically instead of serving 500s to real users.
export function health(_req: Request, res: Response) {
  res.status(200).json({ status: "ok" });
}

export async function ready(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: "ready", db: "ok", redis: "ok" });
  } catch (err) {
    res
      .status(503)
      .json({ status: "not_ready", error: err instanceof Error ? err.message : "unknown" });
  }
}
