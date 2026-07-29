import Redis from "ioredis";
import { env } from "./env";

// Shared Redis client — rate-limit counters (Handbook 5.6) and session bookkeeping
// today; the AI context cache and BullMQ job queue (Handbook 5.8/9.3) arrive with
// their owning phases and may split onto separate instances at Horizon 2 (10.5).
//
// maxRetriesPerRequest is low (not ioredis's default of 20) so a Redis outage
// surfaces to rate-limit.service's fail-open catch within a couple of retries
// instead of stalling every request for the full default retry budget.
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
