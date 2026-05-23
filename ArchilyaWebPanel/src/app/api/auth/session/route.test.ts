import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSessionCookieValue: vi.fn(),
  rateLimitAllowed: true,
}));

vi.mock("@/lib/auth/session", () => ({
  createSessionCookieValue: mocks.createSessionCookieValue,
  SESSION_COOKIE_NAME: "archilya_panel_session",
  SESSION_DURATION_MS: 432_000_000,
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

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitAllowed = true;
    mocks.createSessionCookieValue.mockResolvedValue("signed-session-cookie");
  });

  it("creates a panel session cookie for a valid Firebase ID token", async () => {
    const response = await POST(createJsonRequest({ idToken: "valid-id-token-123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.createSessionCookieValue).toHaveBeenCalledWith("valid-id-token-123");
    expect(response.headers.get("set-cookie")).toContain("archilya_panel_session=signed-session-cookie");
  });

  it("returns 400 when idToken is missing", async () => {
    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: expect.stringContaining("Doğrulama hatası") });
    expect(mocks.createSessionCookieValue).not.toHaveBeenCalled();
  });

  it("returns 401 with a safe message when Firebase auth rejects the token", async () => {
    mocks.createSessionCookieValue.mockRejectedValueOnce(
      Object.assign(new Error("Firebase ID token geçersiz. raw-admin-detail"), { status: 401 }),
    );

    const response = await POST(createJsonRequest({ idToken: "invalid-id-token-123" }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Panel oturumu başlatılamadı. Lütfen tekrar giriş yapın." });
    expect(body.error).not.toContain("raw-admin-detail");
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    mocks.rateLimitAllowed = false;

    const response = await POST(createJsonRequest({ idToken: "valid-id-token-123" }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.createSessionCookieValue).not.toHaveBeenCalled();
  });

  it("does not leak unexpected raw error messages", async () => {
    mocks.createSessionCookieValue.mockRejectedValueOnce(new Error("raw firebase admin stack with secret"));

    const response = await POST(createJsonRequest({ idToken: "valid-id-token-123" }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Panel oturumu başlatılamadı. Lütfen tekrar deneyin." });
    expect(body.error).not.toContain("raw firebase admin stack");
  });
});
