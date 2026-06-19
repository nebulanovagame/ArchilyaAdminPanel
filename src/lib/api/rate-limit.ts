import { NextResponse } from "next/server";

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyPrefix: string;
};

type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfter: number };

type RedisRestConfig = {
  url: string;
  token: string;
};

type UpstashPipelineItem = {
  result?: unknown;
  error?: string;
};

const MAX_KEYS = 10_000;
const REDIS_UNAVAILABLE_MESSAGE = "Admin rate limiting unavailable: Redis REST env must be configured";
const buckets = new Map<string, number[]>();

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

function getRedisRestConfig(): RedisRestConfig | null {
  const url = process.env.ADMIN_RATE_LIMIT_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.ADMIN_RATE_LIMIT_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  return { url: url.replace(/\/+$/, ""), token };
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
  config: RedisRestConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const key = getRateLimitKey(request, options);
  const member = `${now}-${crypto.randomUUID()}`;

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", key, 0, windowStart],
      ["ZCARD", key],
      ["ZADD", key, now, member],
      ["PEXPIRE", key, options.windowMs],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis REST rate limit request failed: ${response.status}`);
  }

  const results = (await response.json()) as UpstashPipelineItem[];
  const pipelineError = results.find((item) => item.error)?.error;
  if (pipelineError) {
    throw new Error(`Redis REST rate limit pipeline failed: ${pipelineError}`);
  }

  const count = Number(results[1]?.result ?? 0);

  if (count >= options.limit) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil(options.windowMs / 1000)) };
  }

  return { limited: false };
}

async function checkRateLimitWithStore(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const config = getRedisRestConfig();

  if (!config) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(REDIS_UNAVAILABLE_MESSAGE);
    }

    return checkRateLimit(request, options);
  }

  try {
    return await checkRedisRateLimit(request, options, config);
  } catch (error) {
    console.error("[admin-rate-limit] Redis REST hatasi:", error);
    if (process.env.NODE_ENV === "production") {
      throw new Error("Admin rate limiting unavailable in production: Redis REST request failed");
    }

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
