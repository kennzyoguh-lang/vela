import { redis } from "../lib/redis";
import { logger } from "../lib/logger";

// Redis sliding-window counters — survives across multiple API instances once
// horizontally scaled (Handbook 5.6/1.5 Horizon 2), unlike an in-memory counter.
//
// Fails OPEN on a Redis outage: rate limiting is defense-in-depth, not a
// business rule, so a Redis blip should degrade to "unlimited" rather than
// take the whole API down (or lock every request out) until Redis recovers.
export async function checkAndIncrement(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    logger.warn({ err, key }, "Rate limit check failed — failing open");
    return { allowed: true, remaining: limit };
  }
}

const TWO_FA_LOCKOUT_KEY = (userId: string) => `2fa:lockout:${userId}`;
const TWO_FA_ATTEMPTS_KEY = (userId: string) => `2fa:attempts:${userId}`;
const LOCKOUT_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

export async function isTwoFaLockedOut(userId: string): Promise<boolean> {
  return (await redis.exists(TWO_FA_LOCKOUT_KEY(userId))) === 1;
}

export async function recordTwoFaFailure(userId: string): Promise<void> {
  const attempts = await redis.incr(TWO_FA_ATTEMPTS_KEY(userId));
  if (attempts === 1) await redis.expire(TWO_FA_ATTEMPTS_KEY(userId), LOCKOUT_SECONDS);
  if (attempts >= MAX_ATTEMPTS) {
    await redis.set(TWO_FA_LOCKOUT_KEY(userId), "1", "EX", LOCKOUT_SECONDS);
  }
}

export async function clearTwoFaFailures(userId: string): Promise<void> {
  await redis.del(TWO_FA_ATTEMPTS_KEY(userId), TWO_FA_LOCKOUT_KEY(userId));
}
