import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimitAllowed: true,
}));

vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit: (handler: (request: Request) => Promise<Response>) => async (request: Request) => {
    if (!mocks.rateLimitAllowed) {
      return Response.json(
        { error: "Çok fazla istek. Lütfen biraz bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    return handler(request);
  },
}));

import { POST } from "./route";

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitAllowed = true;
  });

  it("returns ok for backwards compatibility", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    mocks.rateLimitAllowed = false;
    const response = await POST();
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
  });
});
