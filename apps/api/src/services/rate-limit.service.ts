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

// Same fail-open contract as checkAndIncrement above, for the same reason:
// the lockout is defense-in-depth ON TOP OF verifyTotpCode/consumeBackupCode
// actually rejecting a wrong code — it never gates whether a *correct* code
// succeeds. A Redis outage degrading this to "no brute-force throttling"
// leaves login no less safe than before this lockout existed; the
// alternative (propagating the error) would instead lock every legitimate
// user with 2FA enabled out of their own account until Redis recovers,
// which is worse than the risk being traded off.
export async function isTwoFaLockedOut(userId: string): Promise<boolean> {
  try {
    return (await redis.exists(TWO_FA_LOCKOUT_KEY(userId))) === 1;
  } catch (err) {
    logger.warn({ err, userId }, "2FA lockout check failed — failing open");
    return false;
  }
}

export async function recordTwoFaFailure(userId: string): Promise<void> {
  try {
    const attempts = await redis.incr(TWO_FA_ATTEMPTS_KEY(userId));
    if (attempts === 1) await redis.expire(TWO_FA_ATTEMPTS_KEY(userId), LOCKOUT_SECONDS);
    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(TWO_FA_LOCKOUT_KEY(userId), "1", "EX", LOCKOUT_SECONDS);
    }
  } catch (err) {
    logger.warn({ err, userId }, "2FA failure recording failed — the wrong code is still rejected");
  }
}

export async function clearTwoFaFailures(userId: string): Promise<void> {
  try {
    await redis.del(TWO_FA_ATTEMPTS_KEY(userId), TWO_FA_LOCKOUT_KEY(userId));
  } catch (err) {
    logger.warn({ err, userId }, "2FA failure counter clear failed");
  }
}

// Phone+PIN staff login's lockout — own key prefixes so it never collides
// with 2FA's counters (a user could in principle have both credential types
// failing independently). Same shape and same fail-open reasoning as the
// 2FA functions above: brute-force resistance for a 4-6 digit PIN comes
// entirely from this lockout, not from bcrypt's cost factor, so failing
// open on a Redis outage is still strictly better than locking every
// legitimate staff member out of logging a sale until Redis recovers.
const PIN_LOCKOUT_KEY = (userId: string) => `pin:lockout:${userId}`;
const PIN_ATTEMPTS_KEY = (userId: string) => `pin:attempts:${userId}`;

export async function isPinLockedOut(userId: string): Promise<boolean> {
  try {
    return (await redis.exists(PIN_LOCKOUT_KEY(userId))) === 1;
  } catch (err) {
    logger.warn({ err, userId }, "PIN lockout check failed — failing open");
    return false;
  }
}

export async function recordPinFailure(userId: string): Promise<void> {
  try {
    const attempts = await redis.incr(PIN_ATTEMPTS_KEY(userId));
    if (attempts === 1) await redis.expire(PIN_ATTEMPTS_KEY(userId), LOCKOUT_SECONDS);
    if (attempts >= MAX_ATTEMPTS) {
      await redis.set(PIN_LOCKOUT_KEY(userId), "1", "EX", LOCKOUT_SECONDS);
    }
  } catch (err) {
    logger.warn({ err, userId }, "PIN failure recording failed — the wrong PIN is still rejected");
  }
}

export async function clearPinFailures(userId: string): Promise<void> {
  try {
    await redis.del(PIN_ATTEMPTS_KEY(userId), PIN_LOCKOUT_KEY(userId));
  } catch (err) {
    logger.warn({ err, userId }, "PIN failure counter clear failed");
  }
}
