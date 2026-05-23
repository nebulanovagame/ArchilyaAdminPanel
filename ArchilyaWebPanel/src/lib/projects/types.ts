import type { Timestamp } from "firebase/firestore";

export type ProjectDateValue = Date | Timestamp | null;

export type ProjectStatus = "Aktif" | "İncelemede" | "Tamamlandı" | "Taslak";

export type ProjectFileCount = {
  pdf: number;
  dwg: number;
  img: number;
};

export type ProjectFileRecord = {
  name: string;
  url: string;
  size: number;
  type: string;
  path?: string | null;
  storageProvider?: "firebase" | "r2";
  objectKey?: string | null;
  contentType?: string;
  createdAt?: string;
  deletedAt?: string;
  projectId?: string;
  projectName?: string;
  versions?: Array<{
    url: string;
    path?: string | null;
    storageProvider?: "firebase" | "r2";
    objectKey?: string | null;
    contentType?: string;
    size?: number;
    createdAt?: string;
    version?: number;
  }>;
};

export type ProjectRecord = {
  id: string;
  uid: string;
  memberUids: string[];
  name: string;
  location?: string;
  status: ProjectStatus;
  fileCount: ProjectFileCount;
  totalSize: number;
  files: ProjectFileRecord[];
  deletedFiles: ProjectFileRecord[];
  isDeleted: boolean;
  deletedAt: ProjectDateValue;
  createdAt?: ProjectDateValue;
  updatedAt?: ProjectDateValue;
};

export type CreateProjectInput = {
  name: string;
  location?: string;
  status: ProjectStatus;
};

export type OverviewStats = {
  activeCount: number;
  totalProjectCount: number;
  totalFiles: number;
  totalSize: number;
  uniqueMemberCount: number;
};

export type TrashData = {
  deletedProjects: ProjectRecord[];
  deletedFiles: ProjectFileRecord[];
};
