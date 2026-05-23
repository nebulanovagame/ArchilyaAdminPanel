import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionUser = {
  uid: "user-1",
  email: "user@example.com",
  name: "Test User",
  picture: null,
  emailVerified: true,
};

const subscriptionState = {
  planId: "free",
  status: "free",
  startAt: null,
  endAt: null,
  autoRenew: false,
  cancelledAt: null,
  pendingPlanId: null,
  billingCreditBalanceKurus: 0,
};

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  getOptionalSessionUser: vi.fn(),
  requireVerifiedFirebaseIdentity: vi.fn(),
  callFirebaseCallableFromServer: vi.fn(),
  getFirebaseFirestore: vi.fn(),
  requireWorkspacePermission: vi.fn(),
  calculateProrationQuote: vi.fn(),
  getPlanById: vi.fn(),
  getUserSubscriptionDocument: vi.fn(),
  readUserSubscriptionState: vi.fn(),
  buildSubscriptionMirrorUpdate: vi.fn(),
  rateLimitAllowed: true,
}));

vi.mock("firebase/firestore", () => ({
  runTransaction: mocks.runTransaction,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalSessionUser: mocks.getOptionalSessionUser,
}));

vi.mock("@/lib/firebase/callable-server", () => ({
  requireVerifiedFirebaseIdentity: mocks.requireVerifiedFirebaseIdentity,
  callFirebaseCallableFromServer: mocks.callFirebaseCallableFromServer,
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseFirestore: mocks.getFirebaseFirestore,
}));

vi.mock("@/lib/rbac/server", () => ({
  requireWorkspacePermission: mocks.requireWorkspacePermission,
}));

vi.mock("@/lib/subscription", () => ({
  calculateProrationQuote: mocks.calculateProrationQuote,
  getPlanById: mocks.getPlanById,
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

vi.mock("../_shared", () => ({
  ApiRouteError: class ApiRouteError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  buildSubscriptionMirrorUpdate: mocks.buildSubscriptionMirrorUpdate,
  getUserSubscriptionDocument: mocks.getUserSubscriptionDocument,
  isSubscriptionPlanId: (value: string) => ["free", "solo", "pro", "studio"].includes(value),
  readUserSubscriptionState: mocks.readUserSubscriptionState,
}));

import { POST } from "./route";

const validBody = {
  idToken: "valid-id-token-123",
  workspaceId: "workspace-1",
  targetPlanId: "solo",
  quoteId: "quote-1",
};

function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/subscription/change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscription/change", () => {
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
    mocks.getFirebaseFirestore.mockReturnValue({ db: true });
    mocks.getUserSubscriptionDocument.mockResolvedValue({ ref: { path: "users/user-1" }, state: subscriptionState });
    mocks.calculateProrationQuote.mockReturnValue({
      changeType: "upgrade",
      amountDueKurus: 100,
      billingCreditKurus: 0,
      effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
      daysRemaining: 30,
      currentPlanId: "free",
      targetPlanId: "solo",
    });
    mocks.getPlanById.mockReturnValue({ id: "solo" });
    mocks.callFirebaseCallableFromServer.mockResolvedValue({
      checkoutFormContent: "<form>checkout</form>",
      token: "checkout-token",
    });
    mocks.readUserSubscriptionState.mockReturnValue(subscriptionState);
    mocks.buildSubscriptionMirrorUpdate.mockReturnValue({ pendingPlanId: "free" });
    mocks.runTransaction.mockImplementation(async (_db, callback) => callback({
      get: vi.fn().mockResolvedValue({ data: () => ({}) }),
      update: vi.fn(),
    }));
  });

  it("creates a checkout form for an authorized upgrade", async () => {
    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      checkoutFormContent: "<form>checkout</form>",
      token: "checkout-token",
      message: "Plan yükseltme için ödeme formu hazırlandı.",
    });
    expect(mocks.requireWorkspacePermission).toHaveBeenCalledWith("user-1", "workspace-1", "workspace.billing");
    expect(mocks.callFirebaseCallableFromServer).toHaveBeenCalledWith("createIyzicoCheckoutForm", "valid-id-token-123", {
      planId: "solo",
      userEmail: "user@example.com",
      userId: "user-1",
      userName: "Test User",
    });
  });

  it("returns 400 when targetPlanId is missing", async () => {
    const response = await POST(createJsonRequest({ ...validBody, targetPlanId: undefined }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Doğrulama hatası");
    expect(mocks.callFirebaseCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 400 when targetPlanId is not a known plan", async () => {
    const response = await POST(createJsonRequest({ ...validBody, targetPlanId: "enterprise" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Geçerli bir targetPlanId gönderin." });
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

  it("schedules a downgrade without creating checkout", async () => {
    mocks.calculateProrationQuote.mockReturnValue({
      changeType: "downgrade",
      amountDueKurus: 0,
      billingCreditKurus: 500,
      effectiveAt: new Date("2026-02-01T00:00:00.000Z"),
      daysRemaining: 20,
      currentPlanId: "studio",
      targetPlanId: "solo",
    });
    mocks.getUserSubscriptionDocument.mockResolvedValueOnce({
      ref: { path: "users/user-1" },
      state: { ...subscriptionState, planId: "studio", startAt: new Date("2026-01-01T00:00:00.000Z"), endAt: new Date("2099-02-01T00:00:00.000Z") },
    });

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      scheduledDowngrade: true,
      message: "Plan değişikliği dönem sonunda uygulanmak üzere planlandı.",
    });
    expect(mocks.runTransaction).toHaveBeenCalled();
    expect(mocks.callFirebaseCallableFromServer).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limiter blocks the change", async () => {
    mocks.rateLimitAllowed = false;

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ error: "Çok fazla istek. Lütfen biraz bekleyin." });
    expect(mocks.getOptionalSessionUser).not.toHaveBeenCalled();
  });

  it("does not leak raw payment provider errors", async () => {
    mocks.callFirebaseCallableFromServer.mockRejectedValueOnce(new Error("raw iyzico provider stack"));

    const response = await POST(createJsonRequest(validBody));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Abonelik değişikliği işlenemedi." });
    expect(body.error).not.toContain("raw iyzico");
  });
});
