import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authRateLimits } from "@/db/schema";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryBuckets = new Map<string, MemoryBucket>();
const MAX_MEMORY_BUCKETS = 1_000;
let dbCleanupCounter = 0;

export function getClientIpFromHeaders(headersList: {
  get(name: string): string | null;
}): string {
  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 64);
  }
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 64);
    }
  }
  return "unknown";
}

function pruneExpiredMemoryBuckets(now: number) {
  if (memoryBuckets.size < MAX_MEMORY_BUCKETS) return;
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= now) {
      memoryBuckets.delete(key);
    }
  }
  if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
    const overflow = memoryBuckets.size - Math.floor(MAX_MEMORY_BUCKETS / 2);
    let removed = 0;
    for (const key of memoryBuckets.keys()) {
      memoryBuckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

export function checkMemoryRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = params.now ?? Date.now();
  pruneExpiredMemoryBuckets(now);

  const existing = memoryBuckets.get(params.key);
  if (!existing || existing.resetAt <= now) {
    const nextReset = now + params.windowMs;
    memoryBuckets.set(params.key, { count: 1, resetAt: nextReset });
    return {
      allowed: true,
      remaining: Math.max(0, params.limit - 1),
      retryAfterSec: Math.ceil(params.windowMs / 1000),
    };
  }

  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, params.limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function clearMemoryRateLimits(): void {
  memoryBuckets.clear();
}

async function maybePruneExpiredDbRateLimits() {
  dbCleanupCounter += 1;
  if (dbCleanupCounter % 50 !== 0) return;
  try {
    await db
      .delete(authRateLimits)
      .where(lt(authRateLimits.resetAt, new Date()));
  } catch {
    // Non-fatal background cleanup
  }
}

export async function getDbRateLimitStatus(params: {
  key: string;
  limit: number;
}): Promise<RateLimitResult> {
  try {
    const [row] = await db
      .select({
        count: authRateLimits.count,
        resetAt: authRateLimits.resetAt,
      })
      .from(authRateLimits)
      .where(sql`${authRateLimits.key} = ${params.key}`)
      .limit(1);

    const now = Date.now();
    if (!row || row.resetAt.getTime() <= now) {
      return {
        allowed: true,
        remaining: params.limit,
        retryAfterSec: 0,
      };
    }

    const allowed = row.count < params.limit;
    return {
      allowed,
      remaining: Math.max(0, params.limit - row.count),
      retryAfterSec: allowed
        ? 0
        : Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000)),
    };
  } catch (error) {
    console.error("[rate-limit] getDbRateLimitStatus fallback:", error);
    return { allowed: true, remaining: params.limit, retryAfterSec: 0 };
  }
}

export async function recordDbRateLimitHit(params: {
  key: string;
  windowMs: number;
}): Promise<{ count: number; resetAt: Date } | null> {
  const nextReset = new Date(Date.now() + params.windowMs);
  try {
    const [row] = await db
      .insert(authRateLimits)
      .values({
        key: params.key,
        count: 1,
        resetAt: nextReset,
      })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: {
          count: sql`CASE WHEN ${authRateLimits.resetAt} <= NOW() THEN 1 ELSE ${authRateLimits.count} + 1 END`,
          resetAt: sql`CASE WHEN ${authRateLimits.resetAt} <= NOW() THEN ${nextReset} ELSE ${authRateLimits.resetAt} END`,
        },
      })
      .returning({
        count: authRateLimits.count,
        resetAt: authRateLimits.resetAt,
      });

    void maybePruneExpiredDbRateLimits();
    return row ?? null;
  } catch (error) {
    console.error("[rate-limit] recordDbRateLimitHit fallback:", error);
    return null;
  }
}

export async function consumeDbRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const row = await recordDbRateLimitHit({
    key: params.key,
    windowMs: params.windowMs,
  });

  if (!row) {
    return checkMemoryRateLimit(params);
  }

  const now = Date.now();
  const allowed = row.count <= params.limit;
  return {
    allowed,
    remaining: Math.max(0, params.limit - row.count),
    retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000)),
  };
}

export async function resetDbRateLimit(key: string): Promise<void> {
  try {
    await db
      .delete(authRateLimits)
      .where(sql`${authRateLimits.key} = ${key}`);
  } catch {
    // Non-fatal reset
  }
}
