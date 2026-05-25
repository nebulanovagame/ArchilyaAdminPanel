import { createClient } from "@/lib/supabase/client";

import { mapActivityLogDocument, safeParseActivityTimestamp } from "./mapper";
import type { ActivityLogQueryOptions, ActivityLogRecord } from "./types";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_RECENT_LIMIT = 5;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toQueryTimestamp(value: ActivityLogQueryOptions["fromDate"] | ActivityLogQueryOptions["toDate"]) {
  return safeParseActivityTimestamp(value);
}

export async function createActivityLogEntry(
  _db: unknown,
  entry: Omit<ActivityLogRecord, "id">,
): Promise<string> {
  const createdAt = toQueryTimestamp(entry.timestamp) ?? new Date();
  const targetId = String(entry.targetId || "");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_activity_logs")
    .insert({
      workspace_id: entry.workspaceId,
      action: entry.action,
      actor_id: entry.actorUid,
      actor_email: entry.actorEmail,
      actor_name: entry.actorName,
      target_type: entry.targetType,
      target_id: isUuid(targetId) ? targetId : null,
      target_name: entry.targetName,
      category: entry.category,
      metadata: entry.metadata,
      created_at: createdAt.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[activity] createActivityLogEntry error:", error.message);
    throw new Error("Aktivite kaydedilemedi.");
  }

  return data.id;
}

export async function getActivityLogsForWorkspace(
  _db: unknown,
  options: ActivityLogQueryOptions,
): Promise<{ logs: ActivityLogRecord[]; hasMore: boolean; nextCursor?: number }> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = typeof options.cursor === "number" ? options.cursor : 0;

  const supabase = createClient();

  let query = supabase
    .from("workspace_activity_logs")
    .select("*")
    .eq("workspace_id", options.workspaceId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (options.category) {
    query = query.eq("category", options.category);
  }

  if (options.action) {
    query = query.eq("action", options.action);
  }

  if (options.actorUid) {
    query = query.eq("actor_id", options.actorUid);
  }

  const fromTimestamp = toQueryTimestamp(options.fromDate);
  if (fromTimestamp) {
    query = query.gte("created_at", fromTimestamp.toISOString());
  }

  const toTimestamp = toQueryTimestamp(options.toDate);
  if (toTimestamp) {
    query = query.lte("created_at", toTimestamp.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[activity] getActivityLogsForWorkspace error:", error.message);
    throw new Error("Aktivite logları alınamadı.");
  }

  const logs = (data || []).map((row) => mapActivityLogDocument(row.id, row));
  const hasMore = logs.length === pageSize;
  const nextCursor = hasMore ? offset + pageSize : undefined;

  return { logs, hasMore, nextCursor };
}

export async function getRecentActivityLogs(
  _db: unknown,
  workspaceId: string,
  maxCount = DEFAULT_RECENT_LIMIT,
): Promise<ActivityLogRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_activity_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(maxCount);

  if (error) {
    console.warn("[activity] getRecentActivityLogs error:", error.message);
    throw new Error("Son aktiviteler alınamadı.");
  }

  return (data || []).map((row) => mapActivityLogDocument(row.id, row));
}
