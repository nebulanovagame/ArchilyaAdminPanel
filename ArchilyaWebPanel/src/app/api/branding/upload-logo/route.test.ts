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
  uploadWorkspaceLogo: vi.fn(),
  requireWorkspacePermission: vi.fn(),
  rateLimitAllowed: true,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalSessionUser: mocks.getOptionalSessionUser,
}));

vi.mock("@/lib/supabase/callable", () => ({
  requireVerifiedSupabaseIdentity: mocks.requireVerifiedSupabaseIdentity,
}));

vi.mock("@/lib/branding/service", () => ({
  uploadWorkspaceLogo: mocks.uploadWorkspaceLogo,
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

function createLogoRequest(overrides: { accessToken?: string; workspaceId?: string; logo?: File | null } = {}) {
  const formData = new FormData();
  formData.set("accessToken", overrides.accessToken ?? "valid-access-token-123");
  formData.set("workspaceId", overrides.workspaceId ?? "workspace-1");
  if (overrides.logo !== null) {
    formData.set("logo", overrides.logo ?? new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" }));
  }

  return new Request("http://localhost/api/branding/upload-logo", { method: "POST", body: formData });
}

describe("POST /api/branding/upload-logo", () => {
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
    mocks.uploadWorkspaceLogo.mockResolvedValue("https://cdn.example.com/logo.png");
    mocks.requireWorkspacePermission.mockResolvedValue("owner");
  });

  it("uploads a valid logo for an authorized workspace user", async () => {
    const response = await POST(createLogoRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, logoUrl: "https://cdn.example.com/logo.png" });
    expect(mocks.requireVerifiedSupabaseIdentity).toHaveBeenCalledWith(sessionUser, "valid-access-token-123");
    expect(mocks.requireWorkspacePermission).toHaveBeenCalledWith("user-1", "workspace-1", "workspace.branding");
    expect(mocks.uploadWorkspaceLogo).toHaveBeenCalledWith(null, "workspace-1", expect.any(File));
  });

  it("returns 400 when the multipart form is missing logo", async () => {
    const response = await POST(createLogoRequest({ logo: null }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Doğrulama hatası");
    expect(mocks.uploadWorkspaceLogo).not.toHaveBeenCalled();
  });

  it("returns 401 with a safe message when session is missing", async () => {
    mocks.getOptionalSessionUser.mockResolvedValueOnce(null);

    const response = await POST(createLogoRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." });
    expect(body.error).not.toContain("raw-session-detail");
    expect(mocks.uploadWorkspaceLogo).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limiter blocks the upload", async () => {
    mocks.rateLimitAllowed = false;

    const response = await POST(createLogoRequest());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
    expect(mocks.getOptionalSessionUser).not.toHaveBeenCalled();
  });

  it("does not leak raw storage errors", async () => {
    mocks.uploadWorkspaceLogo.mockRejectedValueOnce(new Error("raw storage bucket secret path"));

    const response = await POST(createLogoRequest());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Logo yüklenemedi." });
    expect(body.error).not.toContain("raw storage bucket");
  });
});
