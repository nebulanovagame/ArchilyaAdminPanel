import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionUser = {
  uid: "user-1",
  email: "user@example.com",
  name: "Test User",
  picture: null,
  emailVerified: true,
};

const mocks = vi.hoisted(() => ({
  getOptionalSessionUser: vi.fn(),
  requireVerifiedSupabaseIdentity: vi.fn(),
  callBackendCallableFromServer: vi.fn(),
  requireWorkspacePermission: vi.fn(),
  rateLimitAllowed: true,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalSessionUser: mocks.getOptionalSessionUser,
}));

vi.mock("@/lib/supabase/callable", () => ({
  requireVerifiedSupabaseIdentity: mocks.requireVerifiedSupabaseIdentity,
  callBackendCallableFromServer: mocks.callBackendCallableFromServer,
}));

vi.mock("@/lib/rbac/server", () => ({
  requireWorkspacePermission: mocks.requireWorkspacePermission,
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

const validBody = {
  accessToken: "valid-access-token-123",
  workspaceId: "workspace-1",
  amount: 25,
  idempotencyKey: "idem-key-1",
  description: "refund job",
};

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/credits/refund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/credits/refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitAllowed = true;
    mocks.getOptionalSessionUser.mockResolvedValue(sessionUser);
    mocks.requireVerifiedSupabaseIdentity.mockImplementation(async (currentSessionUser) => {
      if (!currentSessionUser) {
        throw Object.assign(new Error("Oturum bulunamadı. raw-session-detail"), { status: 401 });
      }

      return sessionUser;
    });
    mocks.requireWorkspacePermission.mockResolvedValue("owner");
    mocks.callBackendCallableFromServer.mockResolvedValue({ ok: true });
  });

  it("refunds credits for an authorized billing request", async () => {
    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.requireWorkspacePermission).toHaveBeenCalledWith("user-1", "workspace-1", "workspace.billing");
    expect(mocks.callBackendCallableFromServer).toHaveBeenCalledWith("refundCredits", "valid-access-token-123", {
      amount: 25,
      description: "refund job",
    });
  });

  it("returns 400 when amount is invalid", async () => {
    const response = await POST(createJsonRequest({ ...validBody, amount: 0 }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Doğrulama hatası");
    expect(mocks.callBackendCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 401 with a safe message when session is missing", async () => {
    mocks.getOptionalSessionUser.mockResolvedValueOnce(null);

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." });
    expect(body.error).not.toContain("raw-session-detail");
    expect(mocks.callBackendCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limiter blocks the refund", async () => {
    mocks.rateLimitAllowed = false;

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
    expect(mocks.getOptionalSessionUser).not.toHaveBeenCalled();
  });

  it("does not leak raw callable errors", async () => {
    mocks.callBackendCallableFromServer.mockRejectedValueOnce(new Error("raw refund backend stack"));

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Kredi iadesi yapılamadı." });
    expect(body.error).not.toContain("raw refund backend");
  });
});
