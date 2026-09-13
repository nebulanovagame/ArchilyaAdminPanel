import { NextResponse } from "next/server";
import Redis from "ioredis";

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfter: number };

const MAX_KEYS = 10_000;
const REDIS_URL_MISSING_MESSAGE =
  "[admin-rate-limit] REDIS_URL tanimli degil; in-memory rate limiting kullaniliyor.";
const REDIS_ERROR_MESSAGE =
  "[admin-rate-limit] Redis hatasi; in-memory rate limiting kullaniliyor.";

const buckets = new Map<string, number[]>();

// Tembel Redis istemcisi: `undefined` = henuz cozulmedi, `null` = kullanilamaz.
// Modul yuklenirken baglanti ACILMAZ; ilk kullanimda getRedis() icinde olusturulur.
let redis: Redis | null | undefined;

export const adminRateLimits = {
  read: { limit: 60, windowMs: 60_000, keyPrefix: "admin-read" },
  auth: { limit: 20, windowMs: 60_000, keyPrefix: "admin-auth" },
  mutation: { limit: 10, windowMs: 60_000, keyPrefix: "admin-mutation" },
  sensitiveMutation: { limit: 5, windowMs: 60_000, keyPrefix: "admin-sensitive" },
  broadcast: { limit: 3, windowMs: 60_000, keyPrefix: "admin-broadcast" },
} satisfies Record<string, RateLimitOptions>;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  return request.headers.get("x-real-ip")
    || request.headers.get("cf-connecting-ip")
    || "unknown";
}

function pruneBuckets(): void {
  while (buckets.size > MAX_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) return;
    buckets.delete(oldestKey);
  }
}

/**
 * Redis istemcisini tembel (lazy) olusturur. `REDIS_URL` yoksa `console.warn` ile
 * uyarip `null` doner; boylece in-memory limiter kullanilir. Istemci bir kez
 * olusturulur ve modul kapsaminda yeniden kullanilir.
 */
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn(REDIS_URL_MISSING_MESSAGE);
    redis = null;
    return redis;
  }

  try {
    redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  } catch (error) {
    console.error(REDIS_ERROR_MESSAGE, error);
    redis = null;
  }

  return redis;
}

function getRateLimitKey(request: Request, options: RateLimitOptions): string {
  const url = new URL(request.url);
  return `${options.keyPrefix}:${getClientIp(request)}:${url.pathname}`;
}

export function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const key = getRateLimitKey(request, options);
  const timestamps = (buckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (timestamps.length >= options.limit) {
    buckets.set(key, timestamps);
    const retryAfter = Math.max(1, Math.ceil(((timestamps[0] ?? now) + options.windowMs - now) / 1000));
    return { limited: true, retryAfter };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  pruneBuckets();

  return { limited: false };
}

async function checkRedisRateLimit(
  request: Request,
  options: RateLimitOptions,
  client: Redis,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const key = getRateLimitKey(request, options);
  const member = `${now}-${crypto.randomUUID()}`;

  const pipeline = client.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.zadd(key, now, member);
  pipeline.pexpire(key, options.windowMs);

  // ioredis pipeline.exec() -> [[err, result], ...]
  const results = await pipeline.exec();
  const count = typeof results?.[1]?.[1] === "number" ? (results[1][1] as number) : 0;

  if (count >= options.limit) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil(options.windowMs / 1000)) };
  }

  return { limited: false };
}

async function checkRateLimitWithStore(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const client = getRedis();

  if (!client) {
    return checkRateLimit(request, options);
  }

  try {
    return await checkRedisRateLimit(request, options, client);
  } catch (error) {
    console.error(REDIS_ERROR_MESSAGE, error);
    return checkRateLimit(request, options);
  }
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}

export function withRateLimit<TContext>(
  handler: (request: Request, context: TContext) => Promise<Response>,
  options: RateLimitOptions,
): (request: Request, context: TContext) => Promise<Response> {
  return async (request: Request, context: TContext) => {
    let result: RateLimitResult;
    try {
      result = await checkRateLimitWithStore(request, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin rate limiting unavailable";
      return NextResponse.json(
        { error: { message, code: "rate-limit-unavailable" } },
        { status: 500 },
      );
    }

    if (result.limited) {
      return NextResponse.json(
        { error: { message: "Cok fazla istek. Lutfen biraz bekleyin.", code: "rate-limited" } },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    }

    return handler(request, context);
  };
}
