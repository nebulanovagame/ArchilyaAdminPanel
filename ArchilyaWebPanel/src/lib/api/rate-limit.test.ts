import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

import { Redis } from "@upstash/redis";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadRateLimit() {
    vi.resetModules();
    const mod = await import("@/lib/api/rate-limit");
    return mod;
  }

  describe("without Redis env", () => {
    it("uses the memory fallback when Redis env is missing", async () => {
      const { isRateLimited } = await loadRateLimit();
      const request = new Request("http://localhost/api/test");

      await expect(isRateLimited(request, { limit: 2, windowMs: 60_000 })).resolves.toEqual({ limited: false });
      await expect(isRateLimited(request, { limit: 2, windowMs: 60_000 })).resolves.toEqual({ limited: false });
      await expect(isRateLimited(request, { limit: 2, windowMs: 60_000 })).resolves.toEqual({
        limited: true,
        retryAfter: 60,
      });
    });

    it("returns 429 through withRateLimit when the memory fallback limit is reached", async () => {
      const { withRateLimit } = await loadRateLimit();
      const request = new Request("http://localhost/api/test");
      const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      const wrapped = withRateLimit(handler, { limit: 1, windowMs: 60_000 });

      const firstResponse = await wrapped(request);
      expect(firstResponse.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);

      const secondResponse = await wrapped(request);
      expect(secondResponse.status).toBe(429);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("fails open for idempotency helpers when Redis env is missing", async () => {
      const { checkIdempotency, markIdempotencyCompleted } = await loadRateLimit();

      await expect(checkIdempotency("user-1", "request-1")).resolves.toBe("new");
      await expect(markIdempotencyCompleted("user-1", "request-1", { ok: true })).resolves.toBeUndefined();
    });
  });

  describe("with Redis env", () => {
    let mockPipeline: {
      zremrangebyscore: ReturnType<typeof vi.fn>;
      zcard: ReturnType<typeof vi.fn>;
      zadd: ReturnType<typeof vi.fn>;
      pexpire: ReturnType<typeof vi.fn>;
      exec: ReturnType<typeof vi.fn>;
    };
    let mockGet: ReturnType<typeof vi.fn>;
    let mockSet: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      mockGet = vi.fn();
      mockSet = vi.fn();

      mockPipeline = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn(),
      };

      vi.mocked(Redis).mockImplementation(
        function () {
          return {
            get: mockGet,
            set: mockSet,
            pipeline: vi.fn().mockReturnValue(mockPipeline),
          } as unknown as Redis;
        }
      );
    });

    it("returns { limited: false } when count is below limit", async () => {
      mockPipeline.exec.mockResolvedValueOnce([null, 3, null, null]);
      const { isRateLimited } = await loadRateLimit();

      const request = new Request("http://localhost/api/test");
      const result = await isRateLimited(request, { limit: 10, windowMs: 60_000 });
      expect(result).toEqual({ limited: false });
    });

    it("returns { limited: true, retryAfter } when count is at limit", async () => {
      mockPipeline.exec.mockResolvedValueOnce([null, 10, null, null]);
      const { isRateLimited } = await loadRateLimit();

      const request = new Request("http://localhost/api/test");
      const result = await isRateLimited(request, { limit: 10, windowMs: 60_000 });
      expect(result).toEqual({ limited: true, retryAfter: 60 });
    });

    it("returns 429 through withRateLimit when limited", async () => {
      mockPipeline.exec.mockResolvedValueOnce([null, 10, null, null]);
      const { withRateLimit } = await loadRateLimit();

      const request = new Request("http://localhost/api/test");
      const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      const wrapped = withRateLimit(handler, { limit: 10, windowMs: 60_000 });

      const response = await wrapped(request);
      expect(response.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body.error).toBe("Çok fazla istek. Lütfen biraz bekleyin.");
      expect(response.headers.get("Retry-After")).toBe("60");
    });

    it("uses the memory fallback on Redis pipeline error", async () => {
      mockPipeline.exec.mockRejectedValueOnce(new Error("Redis connection failed"));
      const { isRateLimited } = await loadRateLimit();

      const request = new Request("http://localhost/api/test");
      const result = await isRateLimited(request, { limit: 1, windowMs: 60_000 });
      expect(result).toEqual({ limited: false });

      mockPipeline.exec.mockRejectedValueOnce(new Error("Redis connection failed"));
      const limitedResult = await isRateLimited(request, { limit: 1, windowMs: 60_000 });
      expect(limitedResult).toEqual({ limited: true, retryAfter: 60 });
    });

    it("uses x-forwarded-for for client IP", async () => {
      mockPipeline.exec.mockResolvedValueOnce([null, 1, null, null]);
      const { isRateLimited } = await loadRateLimit();

      const request = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      await isRateLimited(request, { limit: 10, windowMs: 60_000 });

      expect(mockPipeline.zadd).toHaveBeenCalled();
      const zaddCall = mockPipeline.zadd.mock.calls[0];
      const key = zaddCall[0];
      expect(key).toContain("1.2.3.4");
    });

    it("uses keyPrefix when provided", async () => {
      mockPipeline.exec.mockResolvedValueOnce([null, 1, null, null]);
      const { isRateLimited } = await loadRateLimit();

      const request = new Request("http://localhost/api/test");
      await isRateLimited(request, { limit: 10, windowMs: 60_000, keyPrefix: "api" });

      const zaddCall = mockPipeline.zadd.mock.calls[0];
      const key = zaddCall[0];
      expect(key).toContain("api");
    });

    it("sets pending and returns new for a new idempotency key", async () => {
      mockGet.mockResolvedValueOnce(null);
      mockSet.mockResolvedValueOnce("OK");
      const { checkIdempotency } = await loadRateLimit();

      const result = await checkIdempotency("user-1", "request-1");

      expect(result).toBe("new");
      expect(mockGet).toHaveBeenCalledWith("idempotency:user-1:request-1");
      expect(mockSet).toHaveBeenCalledWith("idempotency:user-1:request-1", "pending", { ex: 86_400 });
    });

    it("returns pending for an in-flight idempotency key", async () => {
      mockGet.mockResolvedValueOnce("pending");
      const { checkIdempotency } = await loadRateLimit();

      const result = await checkIdempotency("user-1", "request-1");

      expect(result).toBe("pending");
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("returns completed for a completed idempotency key", async () => {
      mockGet.mockResolvedValueOnce('completed:{"ok":true}');
      const { checkIdempotency } = await loadRateLimit();

      const result = await checkIdempotency("user-1", "request-1");

      expect(result).toBe("completed");
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("marks idempotency keys as completed with cached response", async () => {
      mockSet.mockResolvedValueOnce("OK");
      const { markIdempotencyCompleted } = await loadRateLimit();

      await markIdempotencyCompleted("user-1", "request-1", { ok: true });

      expect(mockSet).toHaveBeenCalledWith(
        "idempotency:user-1:request-1",
        'completed:{"ok":true}',
        { ex: 86_400 },
      );
    });

    it("fails open when idempotency check hits a Redis error", async () => {
      mockGet.mockRejectedValueOnce(new Error("Redis connection failed"));
      const { checkIdempotency } = await loadRateLimit();

      await expect(checkIdempotency("user-1", "request-1")).resolves.toBe("new");
    });

    it("ignores Redis errors when marking idempotency completed", async () => {
      mockSet.mockRejectedValueOnce(new Error("Redis connection failed"));
      const { markIdempotencyCompleted } = await loadRateLimit();

      await expect(markIdempotencyCompleted("user-1", "request-1", { ok: true })).resolves.toBeUndefined();
    });
  });
});
