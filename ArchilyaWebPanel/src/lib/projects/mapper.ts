import { getDefaultFileCount } from "./model";
import type { ProjectDateValue, ProjectFileRecord, ProjectRecord } from "./types";

function readString(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  return typeof value === "string" ? value : "";
}

function readNumber(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  return typeof value === "number" ? value : 0;
}

function readBoolean(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  return typeof value === "boolean" ? value : false;
}

function readDateValue(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey): ProjectDateValue {
  const value = data[camelKey] ?? data[snakeKey];
  if (value instanceof Date || typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function readNumberRecord(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

function readStringArray(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  return Array.isArray(value) ? value.map(String) : [];
}

function readProjectTeamMemberUids(data: Record<string, unknown>) {
  const teamMembers = data.project_team_members;
  if (!Array.isArray(teamMembers)) return [];

  return teamMembers
    .map((member) => {
      if (!member || typeof member !== "object") return "";
      const row = member as Record<string, unknown>;
      return String(row.user_uid ?? row.userUid ?? row.uid ?? "");
    })
    .filter(Boolean);
}

function normalizeStorageProvider(value: string): ProjectFileRecord["storageProvider"] {
  if (value === "firebase" || value === "r2" || value === "supabase") return value;
  return undefined;
}

function mapProjectFile(row: ProjectFileRecord | Record<string, unknown>): ProjectFileRecord {
  const data = row as Record<string, unknown>;
  return {
    name: readString(data, "name"),
    url: readString(data, "url"),
    size: readNumber(data, "size"),
    type: readString(data, "type"),
    path: readString(data, "path") || null,
    storageProvider: normalizeStorageProvider(readString(data, "storageProvider", "storage_provider")),
    objectKey: readString(data, "objectKey", "object_key") || null,
    contentType: readString(data, "contentType", "content_type") || undefined,
    createdAt: readString(data, "createdAt", "created_at") || undefined,
    deletedAt: readString(data, "deletedAt", "deleted_at") || undefined,
    projectId: readString(data, "projectId", "project_id") || undefined,
    projectName: readString(data, "projectName", "project_name") || undefined,
    versions: Array.isArray(data.versions) ? data.versions as ProjectFileRecord["versions"] : undefined,
  };
}

function readProjectFiles(data: Record<string, unknown>) {
  const embeddedFiles = data.files;
  const joinedFiles = data.project_files;
  const rawFiles = Array.isArray(embeddedFiles)
    ? embeddedFiles
    : Array.isArray(joinedFiles)
      ? joinedFiles
      : [];

  return rawFiles
    .filter((file): file is ProjectFileRecord | Record<string, unknown> => Boolean(file) && typeof file === "object")
    .map(mapProjectFile);
}

function readDeletedProjectFiles(data: Record<string, unknown>) {
  const embeddedDeletedFiles = data.deletedFiles ?? data.deleted_files;
  if (Array.isArray(embeddedDeletedFiles)) {
    return embeddedDeletedFiles
      .filter((file): file is ProjectFileRecord | Record<string, unknown> => Boolean(file) && typeof file === "object")
      .map(mapProjectFile);
  }

  const joinedFiles = data.project_files;
  if (!Array.isArray(joinedFiles)) return [];

  return joinedFiles
    .filter((file): file is Record<string, unknown> => Boolean(file) && typeof file === "object")
    .filter((file) => readBoolean(file, "isDeleted", "is_deleted"))
    .map(mapProjectFile);
}

export function mapProjectDocument(id: string, data: Record<string, unknown>): ProjectRecord {
  const memberUids = readStringArray(data, "memberUids", "member_uids");

  return {
    id,
    uid: readString(data, "uid"),
    memberUids: memberUids.length ? memberUids : readProjectTeamMemberUids(data),
    name: readString(data, "name"),
    location: readString(data, "location"),
    status: (readString(data, "status") as ProjectRecord["status"]) || "Taslak",
    fileCount: {
      ...getDefaultFileCount(),
      ...readNumberRecord(data, "fileCount", "file_count"),
    },
    totalSize: readNumber(data, "totalSize", "total_size"),
    files: readProjectFiles(data).filter((file) => !file.deletedAt),
    deletedFiles: readDeletedProjectFiles(data),
    isDeleted: readBoolean(data, "isDeleted", "is_deleted"),
    deletedAt: readDateValue(data, "deletedAt", "deleted_at"),
    createdAt: readDateValue(data, "createdAt", "created_at"),
    updatedAt: readDateValue(data, "updatedAt", "updated_at"),
  };
}


