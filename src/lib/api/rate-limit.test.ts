import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";

vi.mock("ioredis", () => ({
  default: vi.fn(),
}));

function makeRequest(path = "/api/admin/users", ip = "203.0.113.10") {
  return new Request(`https://admin.archilya.com${path}`, {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

/**
 * rate-limit modulu Redis istemcisini ve in-memory kovalari modul kapsaminda
 * onbellege alir. Her testte temiz durum icin modul kaydini sifirlayip hem
 * ioredis mock'unu hem de modulu ayni kayittan yeniden yukluyoruz; boylece
 * testin tuttugu mock referansi modulun kullandigi referansla ayni olur.
 */
async function loadRateLimit() {
  vi.resetModules();
  const { default: RedisMock } = (await import("ioredis")) as unknown as {
    default: ReturnType<typeof vi.fn>;
  };
  const mod = await import("./rate-limit");
  return { mod, RedisMock };
}

describe("admin rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("checkRateLimit (in-memory)", () => {
    it("allows requests below the configured limit", async () => {
      const { mod } = await loadRateLimit();

      const result = mod.checkRateLimit(makeRequest(), {
        limit: 2,
        windowMs: 60_000,
        keyPrefix: "test",
      });

      expect(result).toEqual({ limited: false });
    });

    it("blocks requests after the configured limit and reset clears state", async () => {
      const { mod } = await loadRateLimit();
      const options = { limit: 2, windowMs: 60_000, keyPrefix: "test" };

      mod.checkRateLimit(makeRequest(), options);
      mod.checkRateLimit(makeRequest(), options);
      const blocked = mod.checkRateLimit(makeRequest(), options);
      expect(blocked.limited).toBe(true);
      if (blocked.limited) {
        expect(blocked.retryAfter).toBeGreaterThan(0);
      }

      mod.resetRateLimitForTests();
      expect(mod.checkRateLimit(makeRequest(), options)).toEqual({ limited: false });
    });
  });

  describe("REDIS_URL unset", () => {
    it("does not eagerly connect and checkRateLimit returns in-memory results", async () => {
      const { mod, RedisMock } = await loadRateLimit();

      // Import aninda Redis istemcisi olusturulmamali.
      expect(RedisMock).not.toHaveBeenCalled();

      const options = { limit: 2, windowMs: 60_000, keyPrefix: "test" };
      expect(mod.checkRateLimit(makeRequest(), options)).toEqual({ limited: false });
      expect(mod.checkRateLimit(makeRequest(), options)).toEqual({ limited: false });

      const third = mod.checkRateLimit(makeRequest(), options);
      expect(third.limited).toBe(true);
      expect(RedisMock).not.toHaveBeenCalled();
    });

    it("falls back to in-memory limiting in production when REDIS_URL is missing", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { mod, RedisMock } = await loadRateLimit();
      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = mod.withRateLimit(handler, { limit: 2, windowMs: 60_000, keyPrefix: "test" });

      // Redis yokken uretimde istekler engellenmemeli (in-memory fallback calisir).
      const first = await wrapped(makeRequest(), undefined);
      expect(first.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);

      const second = await wrapped(makeRequest(), undefined);
      expect(second.status).toBe(200);

      // In-memory limit yine de uygulanir: limit 2 -> ucuncu istek 429.
      const third = await wrapped(makeRequest(), undefined);
      expect(third.status).toBe(429);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(RedisMock).not.toHaveBeenCalled();
    });
  });

  describe("REDIS_URL set", () => {
    type PipelineMock = {
      zremrangebyscore: ReturnType<typeof vi.fn>;
      zcard: ReturnType<typeof vi.fn>;
      zadd: ReturnType<typeof vi.fn>;
      pexpire: ReturnType<typeof vi.fn>;
      exec: ReturnType<typeof vi.fn>;
    };

    let mockPipeline: PipelineMock;

    beforeEach(() => {
      vi.stubEnv("REDIS_URL", "redis://default:token@redis:6379/0");

      mockPipeline = {
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn(),
      };
    });

    function installRedisMock(RedisMock: ReturnType<typeof vi.fn>) {
      RedisMock.mockImplementation(function () {
        return {
          pipeline: vi.fn().mockReturnValue(mockPipeline),
        } as unknown as Redis;
      });
    }

    it("constructs the client lazily with REDIS_URL and lazyConnect", async () => {
      const { mod, RedisMock } = await loadRateLimit();
      installRedisMock(RedisMock);
      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = mod.withRateLimit(handler, { limit: 10, windowMs: 60_000, keyPrefix: "test" });

      expect(RedisMock).not.toHaveBeenCalled();

      mockPipeline.exec.mockResolvedValueOnce([[null, null], [null, 3], [null, null], [null, null]]);
      await wrapped(makeRequest(), undefined);

      expect(RedisMock).toHaveBeenCalledTimes(1);
      expect(RedisMock).toHaveBeenCalledWith("redis://default:token@redis:6379/0", {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    });

    it("allows requests below the limit using the Redis store", async () => {
      const { mod, RedisMock } = await loadRateLimit();
      installRedisMock(RedisMock);
      // ioredis pipeline.exec() -> [[err, result], ...]
      mockPipeline.exec.mockResolvedValueOnce([[null, null], [null, 3], [null, null], [null, null]]);

      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = mod.withRateLimit(handler, { limit: 10, windowMs: 60_000, keyPrefix: "test" });

      const response = await wrapped(makeRequest(), undefined);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockPipeline.zadd).toHaveBeenCalled();
    });

    it("returns 429 when the Redis count reaches the limit", async () => {
      const { mod, RedisMock } = await loadRateLimit();
      installRedisMock(RedisMock);
      mockPipeline.exec.mockResolvedValueOnce([[null, null], [null, 10], [null, null], [null, null]]);

      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = mod.withRateLimit(handler, { limit: 10, windowMs: 60_000, keyPrefix: "test" });

      const response = await wrapped(makeRequest(), undefined);

      expect(response.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
      expect(response.headers.get("Retry-After")).toBe("60");
      await expect(response.json()).resolves.toEqual({
        error: { message: "Cok fazla istek. Lutfen biraz bekleyin.", code: "rate-limited" },
      });
    });

    it("falls back to in-memory when Redis throws", async () => {
      const { mod, RedisMock } = await loadRateLimit();
      installRedisMock(RedisMock);
      mockPipeline.exec.mockRejectedValue(new Error("Redis connection failed"));

      const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const wrapped = mod.withRateLimit(handler, { limit: 1, windowMs: 60_000, keyPrefix: "test" });

      const first = await wrapped(makeRequest(), undefined);
      expect(first.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);

      const second = await wrapped(makeRequest(), undefined);
      expect(second.status).toBe(429);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
