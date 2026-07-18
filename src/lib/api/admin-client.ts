/**
 * Admin API Client — local API routes then mock fallback.
 *
 * Priority:
 *   1. Local /api/admin/* routes (query Supabase directly via service_role)
 *   2. External NEXT_PUBLIC_ADMIN_API_BASE_URL (when deployed)
 *   3. Mock data (development fallback)
 */

import type {
  AdminUser,
  DashboardStats,
  UserRecord,
  WorkspaceRecord,
  ProjectRecord,
  CreditRecord,
  SubscriptionRecord,
  RenderJobRecord,
  AuditLogEntry,
  LegacyProduct,
  PaymentReconciliationResponse,
  PaymentSessionsResponse,
  SendNotificationPayload,
  SendNotificationResponse,
  FeedbackResponse,
  UserActivityResponse,
  PartnerFirmRecord,
  PartnerFirmType,
  FranchiseApplicationRecord,
  FranchiseApplicationStatus,
} from "./types";

import {
  MOCK_ADMIN_USER,
  MOCK_DASHBOARD_STATS,
  MOCK_USERS,
  MOCK_WORKSPACES,
  MOCK_PROJECTS,
  MOCK_CREDITS,
  MOCK_SUBSCRIPTIONS,
  MOCK_RENDER_JOBS,
  MOCK_AUDIT_LOGS,
  MOCK_LEGACY_PRODUCTS,
  MOCK_PARTNER_FIRMS,
  MOCK_FRANCHISE_APPLICATIONS,
  delay,
} from "./mock-data";

const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || "";
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

class AdminApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number = 500, code: string = "internal") {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

async function fetchLocal<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new AdminApiError(
      json?.error?.message || "Admin API istegi basarisiz",
      res.status,
      json?.error?.code || "unknown",
    );
  }

  return (json.data ?? json) as T;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function isMockAllowed(): boolean {
  // Mock fallback sadece development ortaminda kullanilir.
  // Production'da API hata verirse gercek hata kullaniciya gosterilir.
  return !IS_PRODUCTION;
}

/** Try local API route first, then external API, then mock fallback (dev only) */
async function fetchWithFallback<T>(
  localPath: string,
  externalPath: string,
  mockFn: () => T,
): Promise<T> {
  // 1. Try local API route
  try {
    const localRes = await fetch(localPath);
    if (localRes.ok) {
      const json = await localRes.json();
      return (json.data ?? json) as T;
    }
  } catch {
    // network error — try next
  }

  // 2. Try external backend API
  if (API_BASE && _accessToken) {
    try {
      const res = await fetch(`${API_BASE}${externalPath}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${_accessToken}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json();
        return (json.data ?? json) as T;
      }
    } catch {
      // network error — fall through to mock or error
    }
  }

  // 3. Mock fallback (dev only)
  if (isMockAllowed()) {
    await delay(300);
    return mockFn();
  }

  // Production: API hatasini firlat
  throw new AdminApiError(
    "Admin API su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
    503,
    "service_unavailable",
  );
}

// ─── Admin API Methods ─────────────────────────────────

export async function getCurrentAdmin(): Promise<AdminUser> {
  return fetchWithFallback(
    "/api/admin/me",
    "/admin/me",
    () => ({ ...MOCK_ADMIN_USER }),
  );
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchWithFallback(
    "/api/admin/dashboard",
    "/admin/dashboard/stats",
    () => ({ ...MOCK_DASHBOARD_STATS }),
  );
}

export async function listUsers(): Promise<UserRecord[]> {
  return fetchWithFallback(
    "/api/admin/users",
    "/admin/users",
    () => [...MOCK_USERS],
  );
}

export async function getUser(id: string): Promise<UserRecord> {
  return fetchWithFallback(
    `/api/admin/users/${id}`,
    `/admin/users/${id}`,
    () => {
      const user = MOCK_USERS.find((u) => u.id === id);
      if (!user) throw new AdminApiError("Kullanici bulunamadi", 404, "not-found");
      return { ...user };
    },
  );
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  return fetchWithFallback(
    "/api/admin/workspaces",
    "/admin/workspaces",
    () => [...MOCK_WORKSPACES],
  );
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return fetchWithFallback(
    "/api/admin/projects",
    "/admin/projects",
    () => [...MOCK_PROJECTS],
  );
}

export async function listCredits(): Promise<CreditRecord[]> {
  return fetchWithFallback(
    "/api/admin/credits",
    "/admin/credits",
    () => [...MOCK_CREDITS],
  );
}

export async function listSubscriptions(): Promise<SubscriptionRecord[]> {
  return fetchWithFallback(
    "/api/admin/subscriptions",
    "/admin/subscriptions",
    () => [...MOCK_SUBSCRIPTIONS],
  );
}

export async function listRenderJobs(): Promise<RenderJobRecord[]> {
  return fetchWithFallback(
    "/api/admin/render-jobs",
    "/admin/render-jobs",
    () => [...MOCK_RENDER_JOBS],
  );
}

export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  return fetchWithFallback(
    "/api/admin/audit-logs",
    "/admin/audit-logs",
    () => [...MOCK_AUDIT_LOGS],
  );
}

export async function listLegacyProducts(): Promise<LegacyProduct[]> {
  return fetchWithFallback(
    "/api/admin/legacy/products",
    "/admin/legacy/products",
    () => [...MOCK_LEGACY_PRODUCTS],
  );
}

export async function listPaymentSessions(params?: {
  status?: "all" | "pending" | "completed" | "failed";
  page?: number;
  limit?: number;
}): Promise<PaymentSessionsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params?.page) {
    searchParams.set("page", String(params.page));
  }

  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  return fetchLocal<PaymentSessionsResponse>(`/api/admin/payment-sessions${query ? `?${query}` : ""}`);
}

export async function listPaymentReconciliation(): Promise<PaymentReconciliationResponse> {
  return fetchLocal<PaymentReconciliationResponse>("/api/admin/payment-reconciliation");
}

async function postWithFallback<T>(
  localPath: string,
  externalPath: string,
  body: Record<string, unknown>,
  mockFn: () => T,
): Promise<T> {
  // 1. Try local API route
  try {
    const localRes = await fetch(localPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (localRes.ok) {
      const json = await localRes.json();
      return (json.data ?? json) as T;
    }
    const err = await localRes.json().catch(() => ({}));
    throw new AdminApiError(
      err?.error?.message || "Kredi islemi basarisiz",
      localRes.status,
      err?.error?.code || "unknown",
    );
  } catch (e) {
    if (e instanceof AdminApiError) throw e;
    // network error — try next
  }

  // 2. Try external backend API
  if (API_BASE && _accessToken) {
    try {
      const res = await fetch(`${API_BASE}${externalPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${_accessToken}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json();
        return (json.data ?? json) as T;
      }
      const err = await res.json().catch(() => ({}));
      throw new AdminApiError(
        err?.error?.message || "Kredi islemi basarisiz",
        res.status,
        err?.error?.code || "unknown",
      );
    } catch (e) {
      if (e instanceof AdminApiError) throw e;
    }
  }

  // 3. Mock fallback (dev only)
  if (isMockAllowed()) {
    await delay(300);
    return mockFn();
  }

  throw new AdminApiError(
    "Admin API su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
    503,
    "service_unavailable",
  );
}

export async function grantCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return postWithFallback(
    `/api/admin/users/${userId}/credits`,
    `/admin/users/${userId}/credits`,
    { action: "grant", amount, description, idempotencyKey: crypto.randomUUID() },
    () => ({ success: true, balanceAfter: 50000 }),
  );
}

export async function sendNotification(
  payload: SendNotificationPayload,
): Promise<SendNotificationResponse> {
  return postWithFallback(
    "/api/admin/notifications",
    "/admin/notifications",
    {
      ...payload,
      confirmBroadcast: payload.confirmBroadcast ?? !payload.targetUserIds?.length,
    } as Record<string, unknown>,
    () => ({ success: true, sentCount: 1, insertedCount: 1 }),
  );
}

export async function getUserActivity(
  userId: string,
  params?: { limit?: number; offset?: number; type?: string },
): Promise<UserActivityResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.type) searchParams.set("type", params.type);

  const query = searchParams.toString();
  const path = `/api/admin/users/${userId}/activity${query ? `?${query}` : ""}`;
  return fetchLocal<UserActivityResponse>(path);
}

export async function deductCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return postWithFallback(
    `/api/admin/users/${userId}/credits`,
    `/admin/users/${userId}/credits`,
    { action: "deduct", amount, description, idempotencyKey: crypto.randomUUID() },
    () => ({ success: true, balanceAfter: 40000 }),
  );
}

export async function getUserFeedback(
  userId: string,
  params?: { limit?: number },
): Promise<FeedbackResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  const path = `/api/admin/users/${userId}/feedback${query ? `?${query}` : ""}`;
  return fetchLocal<FeedbackResponse>(path);
}

// ─── Partner Firms ──────────────────────────────────────
export async function listPartnerFirms(type?: PartnerFirmType): Promise<PartnerFirmRecord[]> {
  const searchParams = type ? new URLSearchParams({ type }) : new URLSearchParams();
  const query = searchParams.toString();
  const path = `/api/admin/partner-firms${query ? `?${query}` : ""}`;
  return fetchWithFallback(path, "/admin/partner-firms", () => {
    let items = [...MOCK_PARTNER_FIRMS];
    if (type) items = items.filter((f) => f.type === type);
    return items;
  });
}

export async function getPartnerFirm(id: string): Promise<PartnerFirmRecord> {
  return fetchWithFallback(
    `/api/admin/partner-firms/${id}`,
    `/admin/partner-firms/${id}`,
    () => {
      const firm = MOCK_PARTNER_FIRMS.find((f) => f.id === id);
      if (!firm) throw new Error("Firma bulunamadı");
      return firm;
    },
  );
}

export async function createPartnerFirm(
  data: Omit<PartnerFirmRecord, "id" | "createdAt" | "updatedAt">,
): Promise<PartnerFirmRecord> {
  return postWithFallback(
    "/api/admin/partner-firms",
    "/admin/partner-firms",
    data as unknown as Record<string, unknown>,
    () => ({
      ...data,
      id: `pf-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function updatePartnerFirm(
  id: string,
  data: Partial<PartnerFirmRecord>,
): Promise<PartnerFirmRecord> {
  return postWithFallback(
    `/api/admin/partner-firms/${id}`,
    `/admin/partner-firms/${id}`,
    { ...data, id } as unknown as Record<string, unknown>,
    () => {
      const firm = MOCK_PARTNER_FIRMS.find((f) => f.id === id);
      if (!firm) throw new Error("Firma bulunamadı");
      return { ...firm, ...data, updatedAt: new Date().toISOString() };
    },
  );
}

export async function deletePartnerFirm(id: string): Promise<{ success: boolean }> {
  return postWithFallback(
    `/api/admin/partner-firms/${id}/delete`,
    `/admin/partner-firms/${id}/delete`,
    { id },
    () => ({ success: true }),
  );
}

// ─── Franchise Applications ─────────────────────────────

export async function listFranchiseApplications(
  status?: FranchiseApplicationStatus,
): Promise<FranchiseApplicationRecord[]> {
  const searchParams = status ? new URLSearchParams({ status }) : new URLSearchParams();
  const query = searchParams.toString();
  const path = `/api/admin/franchise-applications${query ? `?${query}` : ""}`;
  return fetchWithFallback(path, "/admin/franchise-applications", () => {
    let items = [...MOCK_FRANCHISE_APPLICATIONS];
    if (status) items = items.filter((a) => a.status === status);
    return items;
  });
}

export async function getFranchiseApplication(id: string): Promise<FranchiseApplicationRecord> {
  return fetchWithFallback(
    `/api/admin/franchise-applications/${id}`,
    `/admin/franchise-applications/${id}`,
    () => {
      const app = MOCK_FRANCHISE_APPLICATIONS.find((a) => a.id === id);
      if (!app) throw new Error("Başvuru bulunamadı");
      return { ...app };
    },
  );
}

export async function updateFranchiseApplicationStatus(
  id: string,
  status: FranchiseApplicationStatus,
  adminNote?: string,
): Promise<FranchiseApplicationRecord> {
  return postWithFallback(
    `/api/admin/franchise-applications/${id}`,
    `/admin/franchise-applications/${id}`,
    { status, adminNote } as Record<string, unknown>,
    () => {
      const app = MOCK_FRANCHISE_APPLICATIONS.find((a) => a.id === id);
      if (!app) throw new Error("Başvuru bulunamadı");
      return {
        ...app,
        status,
        adminNote: adminNote ?? app.adminNote,
        updatedAt: new Date().toISOString(),
      };
    },
  );
}
