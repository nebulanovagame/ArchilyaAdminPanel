/**
 * Admin API Client — connects to WebBackend Admin API with mock fallback.
 *
 * All requests go to NEXT_PUBLIC_ADMIN_API_BASE_URL with the user's
 * Supabase access_token as Bearer token.
 *
 * When the backend is unavailable or not configured, mock data is used
 * so the UI remains functional during development.
 *
 * ⚠️ SECURITY:
 * - Admin authorization is verified by the backend (profiles.is_admin check)
 * - The frontend only has the anon key — no secrets here
 * - Backend uses service_role key to query Supabase (server-side only)
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

async function apiFetch<T>(endpoint: string, options?: { method?: string; body?: unknown }): Promise<T> {
  // If no backend configured, skip straight to mock fallback
  if (!API_BASE) {
    throw new AdminApiError(
      "Admin API not configured — use mock data",
      0,
      "mock-fallback",
    );
  }

  if (!_accessToken) {
    throw new AdminApiError("Authentication required. Please log in.", 401, "unauthenticated");
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: options?.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_accessToken}`,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new AdminApiError(
        json?.error?.message || json?.message || `API error (HTTP ${res.status})`,
        res.status,
        json?.error?.code || "api-error",
      );
    }

    return (json.data ?? json) as T;
  } catch (err) {
    // Network errors → fall back to mock
    if (err instanceof AdminApiError) throw err;
    throw new AdminApiError(
      "Backend API'ye ulasilamadi, mock veri kullaniliyor",
      0,
      "mock-fallback",
    );
  }
}

// ─── Mock fallback helper ─────────────────────────────

async function mockOrFetch<T>(endpoint: string, mockFn: () => T): Promise<T> {
  try {
    return await apiFetch<T>(endpoint);
  } catch (err) {
    if (err instanceof AdminApiError && err.code === "mock-fallback") {
      await delay(300);
      return mockFn();
    }
    throw err;
  }
}

// ─── Admin API Methods ─────────────────────────────────

export async function getCurrentAdmin(): Promise<AdminUser> {
  // First try local /api/admin/me route (checks profiles.is_admin)
  try {
    const res = await fetch("/api/admin/me");
    if (res.ok) {
      const json = await res.json();
      return json.data as AdminUser;
    }
    // If the API explicitly says "not admin" (403), don't fall back to mock
    if (res.status === 403) {
      throw new AdminApiError("Admin yetkiniz bulunmuyor", 403, "not-admin");
    }
  } catch (err) {
    if (err instanceof AdminApiError) throw err;
    // Network error → try mock fallback
  }
  // Fall back to external API or mock
  return mockOrFetch("/admin/me", () => ({ ...MOCK_ADMIN_USER }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return mockOrFetch("/admin/dashboard/stats", () => ({ ...MOCK_DASHBOARD_STATS }));
}

export async function listUsers(): Promise<UserRecord[]> {
  return mockOrFetch("/admin/users", () => [...MOCK_USERS]);
}

export async function getUser(id: string): Promise<UserRecord> {
  return mockOrFetch(`/admin/users/${id}`, () => {
    const user = MOCK_USERS.find((u) => u.id === id);
    if (!user) throw new AdminApiError("Kullanici bulunamadi", 404, "not-found");
    return { ...user };
  });
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  return mockOrFetch("/admin/workspaces", () => [...MOCK_WORKSPACES]);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return mockOrFetch("/admin/projects", () => [...MOCK_PROJECTS]);
}

export async function listCredits(): Promise<CreditRecord[]> {
  return mockOrFetch("/admin/credits", () => [...MOCK_CREDITS]);
}

export async function listSubscriptions(): Promise<SubscriptionRecord[]> {
  return mockOrFetch("/admin/subscriptions", () => [...MOCK_SUBSCRIPTIONS]);
}

export async function listRenderJobs(): Promise<RenderJobRecord[]> {
  return mockOrFetch("/admin/render-jobs", () => [...MOCK_RENDER_JOBS]);
}

export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  return mockOrFetch("/admin/audit-logs", () => [...MOCK_AUDIT_LOGS]);
}

export async function listLegacyProducts(): Promise<LegacyProduct[]> {
  return mockOrFetch("/admin/legacy/products", () => [...MOCK_LEGACY_PRODUCTS]);
}

export async function grantCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return mockOrFetch("/admin/credits/grant", () => ({
    success: true,
    balanceAfter: 50000,
  }));
}

export async function deductCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return mockOrFetch("/admin/credits/deduct", () => ({
    success: true,
    balanceAfter: 40000,
  }));
}
