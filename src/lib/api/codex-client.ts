export type CodexConnectionState =
  | "healthy"
  | "expiring"
  | "renewal_required"
  | "incomplete"
  | "missing";

export type CodexAccountHealthStatus = "healthy" | "degraded" | "quarantined";

export type CodexPoolAccount = {
  id: number;
  enabled: boolean;
  healthStatus: CodexAccountHealthStatus;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastError: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

export type CodexPrimaryAccountHealth = {
  enabled: boolean;
  healthStatus: CodexAccountHealthStatus;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastUsedAt: string | null;
  lastErrorCode: string | null;
};

export type CodexConnectionStatus = {
  connected: boolean;
  state: CodexConnectionState;
  authMethod: "chatgpt_oauth";
  source: "persisted" | "environment" | "none";
  model: string;
  probeModel: string;
  planType: string | null;
  expiresAt: string | null;
  secondsRemaining: number | null;
  autoRefreshAvailable: boolean;
  accountBound: boolean;
  updatedAt: string | null;
  providerReachable?: boolean;
  verifiedAt?: string;
  totalAccounts?: number;
  enabledAccounts?: number;
  healthyAccounts?: number;
  availableAccounts?: number;
  primaryAccountHealth?: CodexPrimaryAccountHealth;
  accounts?: CodexPoolAccount[];
};

export type CodexDeviceAuthStatus =
  | "pending"
  | "authorized"
  | "consumed"
  | "failed"
  | "incompatible"
  | "expired"
  | "interrupted";

export type CodexDeviceAuthSession = {
  id: string;
  status: CodexDeviceAuthStatus;
  failureReason: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  consumedAt: string | null;
  updatedAt: string | null;
};

export type CodexLaunchSession = {
  sessionId: string;
  sessionExpiresAt: string;
  launchExpiresAt: string;
  launchUrl: string;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
    code?: string;
  };
};

export class CodexAdminApiError extends Error {
  status: number;
  code: string;
  traceId: string | null;

  constructor(message: string, status: number, code: string, traceId: string | null) {
    super(message);
    this.name = "CodexAdminApiError";
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

async function request<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { Accept: "application/json" },
    cache: "no-store",
  };

  if (body !== undefined && method !== "GET") {
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(body);
  }

  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({})) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new CodexAdminApiError(
      payload.error?.message || "Codex islemi basarisiz.",
      response.status,
      payload.error?.code || "unknown",
      response.headers.get("x-backend-trace-id"),
    );
  }

  return payload;
}

export function getCodexConnectionStatus(): Promise<CodexConnectionStatus> {
  return request("/api/admin/codex/connection");
}

export function verifyCodexConnection(): Promise<CodexConnectionStatus> {
  return request("/api/admin/codex/connection/verify", "POST");
}

export async function getActiveCodexSession(): Promise<CodexDeviceAuthSession | null> {
  const result = await request<{ session: CodexDeviceAuthSession | null }>("/api/admin/codex/session");
  return result.session;
}

export function getCodexSession(id: string): Promise<CodexDeviceAuthSession> {
  return request(`/api/admin/codex/session/${encodeURIComponent(id)}`);
}

export function createCodexSession(accountId?: number): Promise<CodexLaunchSession> {
  return request(
    "/api/admin/codex/session",
    "POST",
    accountId !== undefined ? { accountId } : undefined,
  );
}

export async function resetCodexAccount(
  accountId: number,
): Promise<{ success: boolean; account: CodexPoolAccount }> {
  return request(
    `/api/admin/codex/accounts/${accountId}/reset`,
    "POST",
  );
}

export function formatRemainingTime(seconds: number | null): string {
  if (seconds === null) return "Bilinmiyor";
  if (seconds <= 0) return "Suresi doldu";

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) return `${days} gun ${hours} saat`;
  if (hours > 0) return `${hours} saat ${minutes} dk`;
  if (minutes > 0) return `${minutes} dk`;
  return `${Math.floor(seconds)} sn`;
}
