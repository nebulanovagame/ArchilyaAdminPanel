import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
};

type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfter: number };

const IDEMPOTENCY_TTL_SECONDS = 86_400;
const MAX_MEMORY_RATE_LIMIT_KEYS = 10_000;

let redis: Redis | null = null;
let redisChecked = false;
const memoryRateLimitStore = new Map<string, number[]>();

function getRedis(): Redis | null {
  if (redisChecked) {
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL veya UPSTASH_REDIS_REST_TOKEN tanımlı değil. Bellek rate limiter kullanılacak."
    );
    redisChecked = true;
    redis = null;
    return null;
  }

  redis = new Redis({ url, token });
  redisChecked = true;
  return redis;
}

function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  return "unknown";
}

function makeKey(request: Request, prefix?: string): string {
  const ip = getClientIp(request);
  const url = new URL(request.url);
  const route = `${url.pathname}:${url.search}`;
  return prefix ? `rate-limit:${prefix}:${ip}:${route}` : `rate-limit:${ip}:${route}`;
}

function getRetryAfterSeconds(windowMs: number, oldestTimestamp: number, now: number): number {
  return Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));
}

function pruneMemoryRateLimitStore(): void {
  while (memoryRateLimitStore.size > MAX_MEMORY_RATE_LIMIT_KEYS) {
    const oldestKey = memoryRateLimitStore.keys().next().value;
    if (!oldestKey) {
      return;
    }
    memoryRateLimitStore.delete(oldestKey);
  }
}

function isMemoryRateLimited(request: Request, options: RateLimitOptions): RateLimitResult {
  const key = makeKey(request, options.keyPrefix);
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const timestamps = (memoryRateLimitStore.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (timestamps.length >= options.limit) {
    memoryRateLimitStore.set(key, timestamps);
    return { limited: true, retryAfter: getRetryAfterSeconds(options.windowMs, timestamps[0] ?? now, now) };
  }

  timestamps.push(now);
  memoryRateLimitStore.set(key, timestamps);
  pruneMemoryRateLimitStore();

  return { limited: false };
}

export async function isRateLimited(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const client = getRedis();

  if (!client) {
    return isMemoryRateLimited(request, options);
  }

  const key = makeKey(request, options.keyPrefix);
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  try {
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, { score: now, member });
    pipeline.pexpire(key, options.windowMs);

    const results = await pipeline.exec();
    const count = typeof results?.[1] === "number" ? results[1] : 0;

    if (count >= options.limit) {
      return { limited: true, retryAfter: Math.max(1, Math.ceil(options.windowMs / 1000)) };
    }

    return { limited: false };
  } catch (error) {
    console.error("[rate-limit] Redis hatası, bellek rate limiter kullanılacak:", error);
    return isMemoryRateLimited(request, options);
  }
}

export async function checkIdempotency(
  userId: string,
  key: string,
): Promise<"new" | "completed" | "pending"> {
  const client = getRedis();

  if (!client) {
    return "new";
  }

  const redisKey = `idempotency:${userId}:${key}`;

  try {
    const value = await client.get(redisKey);

    if (typeof value === "string" && value.startsWith("completed:")) {
      JSON.parse(value.slice("completed:".length));
      return "completed";
    }

    if (value === "pending") {
      return "pending";
    }

    await client.set(redisKey, "pending", { ex: IDEMPOTENCY_TTL_SECONDS });
    return "new";
  } catch (error) {
    console.error("[rate-limit] Redis idempotency hatası, kontrol bypass ediliyor:", error);
    return "new";
  }
}

export async function markIdempotencyCompleted(
  userId: string,
  key: string,
  response: object,
): Promise<void> {
  const client = getRedis();

  if (!client) {
    return;
  }

  const redisKey = `idempotency:${userId}:${key}`;

  try {
    await client.set(redisKey, `completed:${JSON.stringify(response)}`, { ex: IDEMPOTENCY_TTL_SECONDS });
  } catch (error) {
    console.error("[rate-limit] Redis idempotency tamamlama hatası, yok sayılıyor:", error);
  }
}

export function withRateLimit<T extends (request: Request) => Promise<Response>>(
  handler: T,
  options: RateLimitOptions,
): T {
  return (async (request: Request): Promise<Response> => {
    const result = await isRateLimited(request, options);

    if (result.limited) {
      return NextResponse.json(
        { error: "Çok fazla istek. Lütfen biraz bekleyin." },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    }

    return handler(request);
  }) as T;
}
