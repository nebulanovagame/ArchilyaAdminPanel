import type { Timestamp } from "firebase/firestore";

export type RenderSessionStatus =
  | "draft"
  | "audited"
  | "markup-done"
  | "spatial-locked"
  | "rendering"
  | "completed"
  | "failed";

export interface SceneMetadata {
  id: string;
  label: string;
  direction: string;
  type: string;
  hasFurnishing: boolean;
  frameQuality: number;
  order: number;
  imageUrl?: string;
}

export interface MaterialMetadata {
  id: string;
  label: string;
  category: string;
  imageUrl?: string;
}

export interface RenderSession {
  id: string;
  uid: string;
  workspaceId: string;
  projectId?: string;
  status: RenderSessionStatus;
  scenes: SceneMetadata[];
  materials: MaterialMetadata[];
  lightPreference: string | null;
  annotations: unknown[];
  constraints: unknown[];
  metricLocks: Record<string, { aspectRatio: number; estimatedDepth: number; volumeScore: number; isLocked: boolean }>;
  consistencyScore: number | null;
  jobId?: string;
  outputImageUrls?: string[];
  createdAt: Timestamp | Date | string;
  updatedAt: Timestamp | Date | string;
}

export interface RenderSessionInput {
  uid: string;
  workspaceId: string;
  projectId?: string;
  status?: RenderSessionStatus;
  scenes?: SceneMetadata[];
  materials?: MaterialMetadata[];
  lightPreference?: string | null;
  annotations?: unknown[];
  constraints?: unknown[];
  metricLocks?: Record<string, { aspectRatio: number; estimatedDepth: number; volumeScore: number; isLocked: boolean }>;
  consistencyScore?: number | null;
  jobId?: string;
  outputImageUrls?: string[];
}
