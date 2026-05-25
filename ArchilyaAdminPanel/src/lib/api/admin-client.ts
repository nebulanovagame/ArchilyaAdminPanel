/**
 * Admin API Client — connects to WebBackend Admin API
 *
 * All requests go to NEXT_PUBLIC_ADMIN_API_BASE_URL with the user's
 * Supabase access_token as Bearer token.
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
  if (!API_BASE) {
    throw new AdminApiError(
      "Admin API base URL (NEXT_PUBLIC_ADMIN_API_BASE_URL) is not configured. " +
      "Set it in .env.local to connect to the backend.",
      500,
      "not-configured",
    );
  }

  if (!_accessToken) {
    throw new AdminApiError("Authentication required. Please log in.", 401, "unauthenticated");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_accessToken}`,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new AdminApiError(
      json?.error?.message || json?.message || `API error (HTTP ${res.status})`,
      res.status,
      json?.error?.code || "api-error",
    );
  }

  // Response format: { data: T } or directly T
  return (json.data ?? json) as T;
}

// ─── Admin API Methods ─────────────────────────────────

export async function getCurrentAdmin(): Promise<AdminUser> {
  return apiFetch<AdminUser>("/admin/me");
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/admin/dashboard/stats");
}

export async function listUsers(): Promise<UserRecord[]> {
  return apiFetch<UserRecord[]>("/admin/users");
}

export async function getUser(id: string): Promise<UserRecord> {
  return apiFetch<UserRecord>(`/admin/users/${id}`);
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  return apiFetch<WorkspaceRecord[]>("/admin/workspaces");
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return apiFetch<ProjectRecord[]>("/admin/projects");
}

export async function listCredits(): Promise<CreditRecord[]> {
  return apiFetch<CreditRecord[]>("/admin/credits");
}

export async function listSubscriptions(): Promise<SubscriptionRecord[]> {
  return apiFetch<SubscriptionRecord[]>("/admin/subscriptions");
}

export async function listRenderJobs(): Promise<RenderJobRecord[]> {
  return apiFetch<RenderJobRecord[]>("/admin/render-jobs");
}

export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>("/admin/audit-logs");
}

export async function listLegacyProducts(): Promise<LegacyProduct[]> {
  return apiFetch<LegacyProduct[]>("/admin/legacy/products");
}

export async function grantCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return apiFetch<{ success: boolean; balanceAfter: number }>("/admin/credits/grant", {
    method: "POST",
    body: { userId, amount, description },
  });
}

export async function deductCredits(
  userId: string,
  amount: number,
  description?: string,
): Promise<{ success: boolean; balanceAfter: number }> {
  return apiFetch<{ success: boolean; balanceAfter: number }>("/admin/credits/deduct", {
    method: "POST",
    body: { userId, amount, description },
  });
}
