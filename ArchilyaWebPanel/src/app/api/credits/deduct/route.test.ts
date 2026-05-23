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
  requireVerifiedFirebaseIdentity: vi.fn(),
  callFirebaseCallableFromServer: vi.fn(),
  requireWorkspacePermission: vi.fn(),
  checkIdempotency: vi.fn(),
  markIdempotencyCompleted: vi.fn(),
  rateLimitAllowed: true,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalSessionUser: mocks.getOptionalSessionUser,
}));

vi.mock("@/lib/firebase/callable-server", () => ({
  requireVerifiedFirebaseIdentity: mocks.requireVerifiedFirebaseIdentity,
  callFirebaseCallableFromServer: mocks.callFirebaseCallableFromServer,
}));

vi.mock("@/lib/rbac/server", () => ({
  requireWorkspacePermission: mocks.requireWorkspacePermission,
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkIdempotency: mocks.checkIdempotency,
  markIdempotencyCompleted: mocks.markIdempotencyCompleted,
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
  idToken: "valid-id-token-123",
  workspaceId: "workspace-1",
  amount: 25,
  idempotencyKey: "idem-key-1",
  description: "render job",
};

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/credits/deduct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/credits/deduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitAllowed = true;
    mocks.getOptionalSessionUser.mockResolvedValue(sessionUser);
    mocks.requireVerifiedFirebaseIdentity.mockImplementation(async (currentSessionUser) => {
      if (!currentSessionUser) {
        throw Object.assign(new Error("Oturum bulunamadı. raw-session-detail"), { status: 401 });
      }

      return sessionUser;
    });
    mocks.requireWorkspacePermission.mockResolvedValue("owner");
    mocks.checkIdempotency.mockResolvedValue("new");
    mocks.markIdempotencyCompleted.mockResolvedValue(undefined);
    mocks.callFirebaseCallableFromServer.mockResolvedValue({ ok: true });
  });

  it("deducts credits for an authorized billing request", async () => {
    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.requireWorkspacePermission).toHaveBeenCalledWith("user-1", "workspace-1", "workspace.billing");
    expect(mocks.checkIdempotency).toHaveBeenCalledWith("user-1", "idem-key-1");
    expect(mocks.callFirebaseCallableFromServer).toHaveBeenCalledWith("ensureUserProfile", "valid-id-token-123", {
      email: "user@example.com",
      displayName: "Test User",
    });
    expect(mocks.callFirebaseCallableFromServer).toHaveBeenCalledWith("deductCredits", "valid-id-token-123", {
      amount: 25,
      description: "render job",
    });
    expect(mocks.markIdempotencyCompleted).toHaveBeenCalledWith("user-1", "idem-key-1", { ok: true });
  });

  it("returns 400 when amount is missing", async () => {
    const response = await POST(createJsonRequest({ ...validBody, amount: undefined }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Doğrulama hatası");
    expect(mocks.callFirebaseCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 401 with a safe message when session is missing", async () => {
    mocks.getOptionalSessionUser.mockResolvedValueOnce(null);

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." });
    expect(body.error).not.toContain("raw-session-detail");
    expect(mocks.callFirebaseCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 409 when the idempotency key is already pending", async () => {
    mocks.checkIdempotency.mockResolvedValueOnce("pending");

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "İşlem zaten devam ediyor." });
    expect(mocks.callFirebaseCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limiter blocks the deduction", async () => {
    mocks.rateLimitAllowed = false;

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
    expect(mocks.getOptionalSessionUser).not.toHaveBeenCalled();
  });

  it("does not leak raw callable errors", async () => {
    mocks.callFirebaseCallableFromServer.mockImplementation(async (name) => {
      if (name === "deductCredits") {
        throw new Error("raw backend stack token");
      }
      return { ok: true };
    });

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Kredi düşülemedi." });
    expect(body.error).not.toContain("raw backend stack");
  });
});
