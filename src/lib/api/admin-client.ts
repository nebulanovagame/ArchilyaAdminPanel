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

/** Try local API route first, then external API, then mock fallback */
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
      // network error — fall through to mock
    }
  }

  // 3. Mock fallback
  await delay(300);
  return mockFn();
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

export async function grantCredits(
  _userId: string,
  _amount: number,
  _description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return { success: true, balanceAfter: 50000 };
}

export async function deductCredits(
  _userId: string,
  _amount: number,
  _description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return { success: true, balanceAfter: 40000 };
}
