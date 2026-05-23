import type {
  DocumentData,
  FirestoreDataConverter,
  PartialWithFieldValue,
  SetOptions,
  WithFieldValue,
} from "firebase/firestore";

import { getDefaultFileCount } from "./model";
import type { ProjectFileRecord, ProjectRecord } from "./types";

export function mapProjectDocument(id: string, data: Record<string, unknown>): ProjectRecord {
  return {
    id,
    uid: String(data.uid || ""),
    memberUids: Array.isArray(data.memberUids) ? data.memberUids.map(String) : [],
    name: String(data.name || ""),
    location: typeof data.location === "string" ? data.location : "",
    status: (data.status as ProjectRecord["status"]) || "Taslak",
    fileCount: {
      ...getDefaultFileCount(),
      ...(typeof data.fileCount === "object" && data.fileCount ? (data.fileCount as Record<string, number>) : {}),
    },
    totalSize: typeof data.totalSize === "number" ? data.totalSize : 0,
    files: Array.isArray(data.files) ? (data.files as ProjectFileRecord[]) : [],
    deletedFiles: Array.isArray(data.deletedFiles) ? (data.deletedFiles as ProjectFileRecord[]) : [],
    isDeleted: Boolean(data.isDeleted),
    deletedAt: (data.deletedAt as ProjectRecord["deletedAt"]) || null,
    createdAt: (data.createdAt as ProjectRecord["createdAt"]) || null,
    updatedAt: (data.updatedAt as ProjectRecord["updatedAt"]) || null,
  };
}

function toProjectFirestore(project: WithFieldValue<ProjectRecord>): WithFieldValue<DocumentData>;
function toProjectFirestore(
  project: PartialWithFieldValue<ProjectRecord>,
  options: SetOptions,
): PartialWithFieldValue<DocumentData>;
function toProjectFirestore(
  project: WithFieldValue<ProjectRecord> | PartialWithFieldValue<ProjectRecord>,
): WithFieldValue<DocumentData> | PartialWithFieldValue<DocumentData> {
  const { id: omittedProjectId, ...projectData } = project;
  if (omittedProjectId === undefined) {
    return projectData;
  }
  return projectData;
}

export const projectConverter: FirestoreDataConverter<ProjectRecord> = {
  fromFirestore(snapshot) {
    return mapProjectDocument(snapshot.id, snapshot.data());
  },
  toFirestore: toProjectFirestore,
};
