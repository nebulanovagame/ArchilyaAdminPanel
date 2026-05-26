import type { AiStudioJobFeedback } from "./service";

export const AI_STUDIO_JOB_SUBCOLLECTION = "aiStudioJobs";

export type AiStudioJobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type AiStudioJobOutputType = "text" | "image";

export type AiStudioJobResult = {
  text: string;
  imageUrl: string;
  mimeType: string;
};

export type AiStudioJobErrorState = {
  code: string;
  message: string;
};

export type AiStudioJobDocument = {
  id: string;
  exists: boolean;
  uid: string;
  userId: string;
  workspaceId: string;
  email: string;
  status: AiStudioJobStatus;
  progressMessage: string;
  toolId: string;
  toolLabel: string;
  outputType: AiStudioJobOutputType;
  style: string;
  sceneEditMode: string;
  referenceCount: number;
  extraNote: string;
  generationVariant: string;
  sourceImageName: string;
  sourceImageMimeType: string;
  sourceImageUri: string;
  result: AiStudioJobResult;
  error: AiStudioJobErrorState | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  queuedAt: Date | null;
  attemptCount: number;
  lockedAt: Date | null;
  lastAttemptError: unknown;
  creditCost: number;
  errorMessage: string;
  billing: unknown;
  metadata: Record<string, unknown>;
  feedback: AiStudioJobFeedback;
};

export const INITIAL_AI_STUDIO_JOB: AiStudioJobDocument = {
  id: "",
  exists: false,
  uid: "",
  userId: "",
  workspaceId: "",
  email: "",
  status: "pending",
  progressMessage: "",
  toolId: "",
  toolLabel: "",
  outputType: "image",
  style: "",
  sceneEditMode: "",
  referenceCount: 0,
  extraNote: "",
  generationVariant: "default",
  sourceImageName: "",
  sourceImageMimeType: "",
  sourceImageUri: "",
  result: {
    text: "",
    imageUrl: "",
    mimeType: "",
  },
  error: null,
  createdAt: null,
  updatedAt: null,
  startedAt: null,
  completedAt: null,
  failedAt: null,
  queuedAt: null,
  attemptCount: 0,
  lockedAt: null,
  lastAttemptError: null,
  creditCost: 0,
  errorMessage: "",
  billing: null,
  metadata: {},
  feedback: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readDateValue(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = readString(value);
    if (normalized) return normalized;
  }
  return "";
}

function readFirstNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = readNumber(value);
    if (normalized) return normalized;
  }
  return 0;
}

function readFirstDate(...values: unknown[]) {
  for (const value of values) {
    const normalized = readDateValue(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeOutputType(value: unknown, fallback: AiStudioJobOutputType = "image"): AiStudioJobOutputType {
  return value === "text" ? "text" : value === "image" ? "image" : fallback;
}

export function normalizeAiStudioJobStatus(value: unknown): AiStudioJobStatus {
  const normalizedValue = readString(value).toLowerCase();
  if (normalizedValue === "queued") return "queued";
  if (normalizedValue === "running" || normalizedValue === "processing" || normalizedValue === "in_progress") return "running";
  if (normalizedValue === "completed" || normalizedValue === "success" || normalizedValue === "done") return "completed";
  if (normalizedValue === "failed" || normalizedValue === "error") return "failed";
  if (normalizedValue === "cancelled" || normalizedValue === "canceled") return "cancelled";
  return "pending";
}

export function isAiStudioJobTerminal(job: Pick<AiStudioJobDocument, "status"> | null | undefined) {
  return job?.status === "completed" || job?.status === "failed" || job?.status === "cancelled";
}

export function mapAiStudioJobSnapshot(snapshot: { id: string; data: () => Record<string, unknown>; exists: boolean }, fallbackId = "") {
  if (!snapshot.exists) {
    return {
      ...INITIAL_AI_STUDIO_JOB,
      id: fallbackId,
    } satisfies AiStudioJobDocument;
  }

  const data = snapshot.data();
  const request = isRecord(data.request) ? data.request : {};
  const input = isRecord(data.input) ? data.input : {};
  const primaryImage = isRecord(input.primaryImage) ? input.primaryImage : {};
  const result = isRecord(data.result) ? data.result : {};
  const resultImage = isRecord(result.image) ? result.image : {};
  const error = isRecord(data.error) ? data.error : {};
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const metadataResult = isRecord(metadata.result) ? metadata.result : {};
  const metadataOutputImage = isRecord(metadataResult.outputImage) ? metadataResult.outputImage : {};
  const sceneReferences = Array.isArray(data.sceneReferences)
    ? data.sceneReferences
    : Array.isArray(request.sceneReferences)
      ? request.sceneReferences
      : [];
  const toolId = readFirstString(data.tool_id, data.toolId, request.tool_id, request.toolId, metadata.toolId);
  const style = readString(data.style) || readString(request.style);
  const sceneEditMode = readString(data.sceneEditMode) || readString(data.workflow) || readString(request.sceneEditMode) || readString(request.workflow);
  const extraNote = readString(data.extraNote) || readString(request.extraNote);
  const imageUrl = readString(resultImage.downloadUrl)
    || readString(resultImage.url)
    || readString(resultImage.dataUrl)
    || readString(metadataOutputImage.downloadUrl)
    || readString(metadataOutputImage.url)
    || readString(metadataOutputImage.dataUrl)
    || readString(result.downloadUrl)
    || readString(result.url)
    || readString(result.dataUrl)
    || readString(result.imageUrl)
    || readString(data.downloadUrl)
    || readString(data.url)
    || readString(data.dataUrl)
    || readString(data.resultImageUrl)
    || readString(data.result_url)
    || readString(data.resultDataUrl)
    || readString(data.savedFileUrl);
  const resultText = readString(result.text)
    || readString(data.result_text)
    || readString(data.resultText)
    || readString(data.text)
    || readString(data.resultTextPreview);
  const mimeType = readString(resultImage.mimeType)
    || readString(metadataOutputImage.mimeType)
    || readString(result.mimeType)
    || readString(data.mimeType)
    || readString(data.resultMimeType);
  const outputType = normalizeOutputType(data.output_type, normalizeOutputType(data.outputType, imageUrl ? "image" : resultText ? "text" : normalizeOutputType(request.output_type, normalizeOutputType(request.outputType))));
  const errorMessage = readFirstString(data.error_message, error.message, data.errorMessage);
  const uid = readFirstString(data.user_id, data.userId, data.uid, metadata.uid);

  return {
    id: snapshot.id,
    exists: true,
    uid,
    userId: uid,
    workspaceId: readFirstString(data.workspace_id, data.workspaceId),
    email: readFirstString(data.email, metadata.email),
    status: normalizeAiStudioJobStatus(data.status),
    progressMessage: readFirstString(data.progress_message, data.progressMessage, data.statusMessage, data.message, metadata.progressMessage),
    toolId,
    toolLabel: readFirstString(data.tool_label, data.toolLabel, request.tool_label, request.toolLabel, metadata.toolLabel),
    outputType,
    style,
    sceneEditMode,
    referenceCount: readNumber(data.referenceCount) || sceneReferences.length,
    extraNote,
    generationVariant: readString(data.generationVariant) || readString(request.generationVariant) || "default",
    sourceImageName: readString(data.sourceImageName) || readString(request.sourceImageName),
    sourceImageMimeType: readString(data.sourceImageMimeType) || readString(request.sourceImageMimeType) || readString(primaryImage.mimeType),
    sourceImageUri: readString(data.sourceImageUri) || readString(request.sourceImageUri) || readString(primaryImage.downloadUrl) || readString(primaryImage.url),
    result: {
      text: resultText,
      imageUrl,
      mimeType,
    },
    error: errorMessage ? {
      code: readFirstString(error.code, data.error_code, data.errorCode),
      message: errorMessage,
    } : null,
    createdAt: readFirstDate(data.created_at, data.createdAt),
    updatedAt: readFirstDate(data.updated_at, data.updatedAt),
    startedAt: readFirstDate(data.started_at, data.startedAt),
    completedAt: readFirstDate(data.completed_at, data.completedAt),
    failedAt: readFirstDate(data.failed_at, data.failedAt),
    queuedAt: readFirstDate(data.queued_at, data.queuedAt),
    attemptCount: readFirstNumber(data.attempt_count, data.attemptCount),
    lockedAt: readFirstDate(data.locked_at, data.lockedAt),
    lastAttemptError: data.last_attempt_error ?? data.lastAttemptError ?? null,
    creditCost: readFirstNumber(data.credit_cost, data.creditCost),
    errorMessage,
    billing: data.billing ?? null,
    metadata,
    feedback: data.feedback === "positive" ? "positive" : data.feedback === "negative" ? "negative" : null,
  } satisfies AiStudioJobDocument;
}
