import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimitAllowed: true,
}));

vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE_NAME: "archilya_panel_session",
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

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitAllowed = true;
  });

  it("clears the panel session cookie", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("archilya_panel_session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 429 when the rate limiter blocks logout", async () => {
    mocks.rateLimitAllowed = false;

    const response = await POST();

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
