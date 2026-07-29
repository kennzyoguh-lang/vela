import { createApp } from "./app";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { redis } from "./lib/redis";
import { prisma } from "./lib/prisma";
import { startJobs } from "./jobs";
import { jobsConnection } from "./jobs/queue";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`VELA API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

let workers: Awaited<ReturnType<typeof startJobs>> = [];
startJobs()
  .then((started) => {
    workers = started;
  })
  .catch((err) => {
    logger.error({ err }, "Failed to start background job workers");
  });

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close();
  await Promise.allSettled([
    ...workers.map((w) => w.close()),
    prisma.$disconnect(),
    redis.quit(),
    jobsConnection.quit(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
