import type { DocumentSnapshot, Timestamp } from "firebase/firestore";
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
  createdAt: Timestamp | Date | null;
  updatedAt: Timestamp | Date | null;
  startedAt: Timestamp | Date | null;
  completedAt: Timestamp | Date | null;
  feedback: AiStudioJobFeedback;
};

export const INITIAL_AI_STUDIO_JOB: AiStudioJobDocument = {
  id: "",
  exists: false,
  uid: "",
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
  return value instanceof Date || isRecord(value) ? (value as Timestamp | Date) : null;
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

export function mapAiStudioJobSnapshot(snapshot: DocumentSnapshot, fallbackId = "") {
  if (!snapshot.exists()) {
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
  const sceneReferences = Array.isArray(data.sceneReferences)
    ? data.sceneReferences
    : Array.isArray(request.sceneReferences)
      ? request.sceneReferences
      : [];
  const toolId = readString(data.toolId) || readString(request.toolId);
  const style = readString(data.style) || readString(request.style);
  const sceneEditMode = readString(data.sceneEditMode) || readString(data.workflow) || readString(request.sceneEditMode) || readString(request.workflow);
  const extraNote = readString(data.extraNote) || readString(request.extraNote);
  const imageUrl = readString(resultImage.downloadUrl)
    || readString(resultImage.url)
    || readString(resultImage.dataUrl)
    || readString(result.downloadUrl)
    || readString(result.url)
    || readString(result.dataUrl)
    || readString(result.imageUrl)
    || readString(data.downloadUrl)
    || readString(data.url)
    || readString(data.dataUrl)
    || readString(data.resultImageUrl)
    || readString(data.resultDataUrl)
    || readString(data.savedFileUrl);
  const resultText = readString(result.text)
    || readString(data.resultText)
    || readString(data.text)
    || readString(data.resultTextPreview);
  const mimeType = readString(resultImage.mimeType)
    || readString(result.mimeType)
    || readString(data.mimeType)
    || readString(data.resultMimeType);
  const outputType = normalizeOutputType(data.outputType, imageUrl ? "image" : resultText ? "text" : normalizeOutputType(request.outputType));
  const errorMessage = readString(error.message) || readString(data.errorMessage);

  return {
    id: snapshot.id,
    exists: true,
    uid: readString(data.uid),
    email: readString(data.email),
    status: normalizeAiStudioJobStatus(data.status),
    progressMessage: readString(data.progressMessage) || readString(data.statusMessage) || readString(data.message),
    toolId,
    toolLabel: readString(data.toolLabel) || readString(request.toolLabel),
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
      code: readString(error.code) || readString(data.errorCode),
      message: errorMessage,
    } : null,
    createdAt: readDateValue(data.createdAt),
    updatedAt: readDateValue(data.updatedAt),
    startedAt: readDateValue(data.startedAt),
    completedAt: readDateValue(data.completedAt),
    feedback: data.feedback === "positive" ? "positive" : data.feedback === "negative" ? "negative" : null,
  } satisfies AiStudioJobDocument;
}
