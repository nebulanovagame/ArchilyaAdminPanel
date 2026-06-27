import "server-only";

import type { UserActivityEntry } from "@/lib/api/types";

export const ACTIVITY_LIMIT = 50;
export const MAX_ACTIVITY_LIMIT = 100;
export const MAX_ACTIVITY_WINDOW = 500;
export const AI_STUDIO_BUCKET = "ai-studio";
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

const SENSITIVE_METADATA_KEYS = new Set([
  "actorEmail",
  "actorName",
  "billing",
  "displayName",
  "email",
  "promptContract",
]);

export type AiJobRow = {
  id: string;
  user_id: string | null;
  tool_id: string | null;
  status: string;
  result_url: string | null;
  result_text: string | null;
  metadata: unknown;
  feedback: string | null;
  created_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
};

export type ActivityLogRow = {
  id: string;
  action: string;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  category: string | null;
  metadata: unknown;
  created_at: string | null;
};

export type CreditTransactionRow = {
  id: string;
  user_id: string | null;
  amount: number | null;
  balance_after: number | null;
  description: string | null;
  metadata: unknown;
  created_at: string | null;
};

export function clampQueryNumber(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), maximum);
}

export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.has(key)) continue;
    sanitized[key] = value && typeof value === "object" && !Array.isArray(value)
      ? sanitizeMetadata(toRecord(value))
      : value;
  }

  return sanitized;
}

export function safeStorageUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

    const configuredOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : null;

    if (configuredOrigin && parsed.origin !== configuredOrigin) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function createSummary(entry: {
  readonly action: string;
  readonly toolId?: string;
  readonly creditAmount?: number;
}): string {
  switch (entry.action) {
    case "aiJobQueued":
      return `AI işi kuyruğa alındı: ${entry.toolId || "bilinmeyen araç"}`;
    case "aiJobCompleted":
      return `AI işi tamamlandı: ${entry.toolId || "bilinmeyen araç"}`;
    case "aiJobFailed":
      return `AI işi başarısız: ${entry.toolId || "bilinmeyen araç"}`;
    case "createProject":
      return "Proje oluşturuldu";
    case "softDeleteProject":
      return "Proje silindi (soft)";
    case "restoreProject":
      return "Proje geri yüklendi";
    case "hardDeleteProject":
      return "Proje kalıcı silindi";
    case "credit_grant":
    case "credits_grant":
      return `${entry.creditAmount || 0} kredi yüklendi`;
    case "credit_deduct":
    case "credits_deduct":
      return `${entry.creditAmount || 0} kredi düşüldü`;
    case "send_notification":
      return "Bildirim gönderildi";
    case "ai_job_manual_retry":
      return `AI işi manuel retry: ${entry.toolId || ""}`;
    default:
      return entry.action || "Bilinmeyen işlem";
  }
}

export function mapActionToType(action: string): UserActivityEntry["type"] {
  const lowerAction = action.toLowerCase();
  if (action.startsWith("aiJob")) {
    if (action === "aiJobCompleted") return "ai_job_completed";
    if (action === "aiJobFailed") return "ai_job_failed";
    return "ai_job_created";
  }
  if (action.startsWith("credit") || action.startsWith("credits_")) return "credit";
  if (lowerAction.includes("project")) return "project";
  if (lowerAction.includes("workspace")) return "workspace";
  if (lowerAction.includes("subscription")) return "subscription";
  if (lowerAction.includes("setting") || lowerAction.includes("profile") || lowerAction.includes("password")) return "settings";
  return "other";
}
