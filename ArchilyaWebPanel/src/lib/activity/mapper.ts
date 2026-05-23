import { ACTION_LABELS } from "./constants";
import type { ActivityAction, ActivityCategory, ActivityLogRecord } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readMetadata(value: unknown) {
  return isRecord(value) ? value : {};
}

function readCategory(value: unknown): ActivityCategory {
  return value === "member" || value === "project" || value === "credit" || value === "ai" || value === "subscription" || value === "file" || value === "workspace"
    ? value
    : "workspace";
}

function readAction(value: unknown): ActivityAction {
  const action = readString(value);

  if (action in ACTION_LABELS) {
    return action as ActivityAction;
  }

  return "createWorkspace";
}

function hasToDate(value: unknown): value is { toDate: () => Date } {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function";
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (hasToDate(value)) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatTarget(record: ActivityLogRecord) {
  return record.targetName || record.targetType || "";
}

export function mapActivityLogDocument(id: string, data: Record<string, unknown>): ActivityLogRecord {
  return {
    id,
    workspaceId: readString(data.workspaceId),
    action: readAction(data.action),
    actorUid: readString(data.actorUid),
    actorEmail: readString(data.actorEmail),
    actorName: readString(data.actorName),
    targetType: readString(data.targetType),
    targetId: readString(data.targetId),
    targetName: readString(data.targetName),
    metadata: readMetadata(data.metadata),
    timestamp: toDate(data.timestamp) || null,
    category: readCategory(data.category),
  };
}

export function getActivityLabel(record: ActivityLogRecord) {
  const actor = record.actorName || record.actorEmail || "Kullanıcı";
  const actionLabel = ACTION_LABELS[record.action] || record.action;
  const target = formatTarget(record);

  return target ? `${actor} ${actionLabel} ${target}` : `${actor} ${actionLabel}`;
}

export function safeParseActivityTimestamp(value: unknown) {
  return toDate(value);
}

export function safeParseActivityMetadata(value: unknown) {
  return readMetadata(value);
}
