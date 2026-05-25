"use client";

import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";

import { getFirebaseFunctions, getFirebaseFirestore } from "@/lib/firebase/client";

const RENDER_PIPELINE_TIMEOUT_MS = 300_000;
const DEPTH_ESTIMATION_TIMEOUT_MS = 120_000;
const SCENE_CONSISTENCY_TIMEOUT_MS = 120_000;

export interface SceneInput {
  id: string;
  label: string;
  imageUrl: string;
}

export interface MaterialInput {
  id: string;
  name: string;
  category: string;
}

export interface StartPipelineInput {
  scenes: SceneInput[];
  materials: MaterialInput[];
  lightPreference?: string;
  moodboardUrls?: string[];
  constraints?: string;
}

export interface StartPipelineResult {
  jobId: string;
  status: string;
}

export interface DepthEstimationInput {
  imageUrl: string;
  sceneId: string;
}

export interface DepthEstimationResult {
  jobId: string;
  status: string;
}

export interface SceneConsistencyInput {
  sceneImageUrls: string[];
  sceneIds: string[];
}

export interface SceneConsistencyResult {
  jobId: string;
  status: string;
  sceneCount: number;
}

export interface RequestRevisionInput {
  jobId: string;
  stageId?: number;
  feedback: string;
  updateConstraints?: boolean;
  workspaceId?: string;
}

export interface RequestRevisionResult {
  jobId: string;
  status: string;
  parentJobId: string;
  revisionStageId: number;
}

function getStartRenderPipelineCallable() {
  return httpsCallable(
    getFirebaseFunctions(),
    "startRenderPipeline",
    { timeout: RENDER_PIPELINE_TIMEOUT_MS },
  );
}

function getEstimateDepthCallable() {
  return httpsCallable(
    getFirebaseFunctions(),
    "estimateDepth",
    { timeout: DEPTH_ESTIMATION_TIMEOUT_MS },
  );
}

function getCompareScenesCallable() {
  return httpsCallable(
    getFirebaseFunctions(),
    "compareScenes",
    { timeout: SCENE_CONSISTENCY_TIMEOUT_MS },
  );
}

function getRequestRevisionCallable() {
  return httpsCallable(getFirebaseFunctions(), "requestRevision", { timeout: 300000 });
}

export async function startRenderPipeline(input: StartPipelineInput): Promise<StartPipelineResult> {
  const result = await getStartRenderPipelineCallable()(input);
  const data = result.data as StartPipelineResult | undefined;

  if (!data?.jobId) {
    throw new Error("Pipeline başlatılamadı: jobId alınamadı.");
  }

  return data;
}

export async function startDepthEstimation(input: DepthEstimationInput): Promise<DepthEstimationResult> {
  const result = await getEstimateDepthCallable()(input);
  const data = result.data as DepthEstimationResult | undefined;

  if (!data?.jobId) {
    throw new Error("Derinlik tahmini başlatılamadı: jobId alınamadı.");
  }

  return data;
}

export async function startSceneConsistency(input: SceneConsistencyInput): Promise<SceneConsistencyResult> {
  const result = await getCompareScenesCallable()(input);
  const data = result.data as SceneConsistencyResult | undefined;

  if (!data?.jobId) {
    throw new Error("Sahne tutarlılığı analizi başlatılamadı: jobId alınamadı.");
  }

  return data;
}

export async function requestRenderRevision(input: RequestRevisionInput): Promise<RequestRevisionResult> {
  const result = await getRequestRevisionCallable()(input);
  // Validate response shape
  const data = result.data as Record<string, unknown>;
  if (!data.jobId || typeof data.jobId !== "string") {
    throw new Error("Invalid response from requestRevision: missing jobId");
  }
  return {
    jobId: data.jobId,
    status: String(data.status ?? "pending"),
    parentJobId: String(data.parentJobId ?? input.jobId),
    revisionStageId: Number(data.revisionStageId ?? input.stageId ?? 1),
  };
}

export type JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobDocument {
  id: string;
  exists: boolean;
  userId: string;
  status: JobStatus;
  progressMessage: string;
  toolId: string;
  toolLabel: string;
  outputType: string;
  stage?: number;
  totalStages?: number;
  scenes?: SceneInput[];
  materials?: MaterialInput[];
  lightPreference?: string;
  moodboardUrls?: string[];
  constraints?: string;
  sceneId?: string;
  sourceImageUri?: string;
  sceneImageUrls?: string[];
  sceneIds?: string[];
  creditCost: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: {
    text?: string;
    imageUrl?: string;
    mimeType?: string;
    depthDataUrl?: string;
    pairScores?: Array<{ pair: string; score: number }>;
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export function mapJobDocument(id: string, data: Record<string, unknown> | undefined): JobDocument {
  const defaultDoc: JobDocument = {
    id,
    exists: false,
    userId: "",
    status: "pending",
    progressMessage: "",
    toolId: "",
    toolLabel: "",
    outputType: "image",
    creditCost: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };

  if (!data) return defaultDoc;

  return {
    ...defaultDoc,
    id,
    exists: true,
    userId: String(data.userId || ""),
    status: normalizeJobStatus(data.status),
    progressMessage: String(data.progressMessage || data.statusMessage || ""),
    toolId: String(data.toolId || ""),
    toolLabel: String(data.toolLabel || ""),
    outputType: String(data.outputType || "image"),
    stage: typeof data.stage === "number" ? data.stage : undefined,
    totalStages: typeof data.totalStages === "number" ? data.totalStages : undefined,
    scenes: Array.isArray(data.scenes) ? data.scenes : undefined,
    materials: Array.isArray(data.materials) ? data.materials : undefined,
    lightPreference: String(data.lightPreference || ""),
    moodboardUrls: Array.isArray(data.moodboardUrls) ? data.moodboardUrls.filter((url): url is string => typeof url === "string") : undefined,
    constraints: String(data.constraints || ""),
    sceneId: String(data.sceneId || ""),
    sourceImageUri: String(data.sourceImageUri || ""),
    sceneImageUrls: Array.isArray(data.sceneImageUrls) ? data.sceneImageUrls.filter((url): url is string => typeof url === "string") : undefined,
    sceneIds: Array.isArray(data.sceneIds) ? data.sceneIds.filter((id): id is string => typeof id === "string") : undefined,
    creditCost: typeof data.creditCost === "number" ? data.creditCost : 0,
    createdAt: String(data.createdAt || new Date().toISOString()),
    updatedAt: String(data.updatedAt || new Date().toISOString()),
    startedAt: data.startedAt ? String(data.startedAt) : null,
    completedAt: data.completedAt ? String(data.completedAt) : null,
    result: mapResult(data.result),
    error: mapError(data.error),
  };
}

function normalizeJobStatus(value: unknown): JobStatus {
  const status = String(value || "").toLowerCase();
  switch (status) {
    case "queued": return "queued";
    case "running":
    case "processing":
    case "in_progress": return "running";
    case "completed":
    case "success":
    case "done": return "completed";
    case "failed":
    case "error": return "failed";
    case "cancelled":
    case "canceled": return "cancelled";
    default: return "pending";
  }
}

function mapResult(result: unknown): JobDocument["result"] {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  return {
    text: String(r.text || ""),
    imageUrl: String(r.imageUrl || r.downloadUrl || r.url || ""),
    mimeType: String(r.mimeType || ""),
    depthDataUrl: String(r.depthDataUrl || ""),
    pairScores: Array.isArray(r.pairScores) ? r.pairScores : undefined,
  };
}

function mapError(error: unknown): JobDocument["error"] {
  if (!error || typeof error !== "object") return null;
  const e = error as Record<string, unknown>;
  const message = String(e.message || e.errorMessage || "");
  if (!message) return null;
  return {
    code: String(e.code || e.errorCode || ""),
    message,
  };
}

export function isJobTerminal(job: Pick<JobDocument, "status"> | null): boolean {
  return job?.status === "completed" || job?.status === "failed" || job?.status === "cancelled";
}

export function subscribeToJob(
  jobId: string,
  onUpdate: (job: JobDocument) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const jobRef = doc(db, "aiStudioJobs", jobId);

  return onSnapshot(
    jobRef,
    (snapshot) => {
      const job = mapJobDocument(snapshot.id, snapshot.data());
      onUpdate(job);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );
}
