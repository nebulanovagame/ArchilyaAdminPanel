import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, resetRateLimitForTests, withRateLimit } from "./rate-limit";

function makeRequest(path = "/api/admin/users", ip = "203.0.113.10") {
  return new Request(`https://admin.archilya.com${path}`, {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("admin rate limit", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("allows requests below the configured limit", () => {
    const result = checkRateLimit(makeRequest(), {
      limit: 2,
      windowMs: 60_000,
      keyPrefix: "test",
    });

    expect(result).toEqual({ limited: false });
  });

  it("blocks requests after the configured limit", () => {
    const options = { limit: 2, windowMs: 60_000, keyPrefix: "test" };

    checkRateLimit(makeRequest(), options);
    checkRateLimit(makeRequest(), options);
    const result = checkRateLimit(makeRequest(), options);

    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.retryAfter).toBeGreaterThan(0);
    }
  });

  it("fails closed in production when shared Redis REST env is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withRateLimit(handler, { limit: 1, windowMs: 60_000, keyPrefix: "test" });

    const response = await wrapped(makeRequest(), undefined);

    expect(response.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Admin rate limiting unavailable: Redis REST env must be configured",
        code: "rate-limit-unavailable",
      },
    });
  });

  it("uses shared Redis REST rate limiting when configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        { result: 0 },
        { result: 0 },
        { result: 1 },
        { result: 1 },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const wrapped = withRateLimit(handler, { limit: 2, windowMs: 60_000, keyPrefix: "test" });

    const response = await wrapped(makeRequest(), undefined);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example.com/pipeline",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer redis-token" }),
      }),
    );
  });
});
