import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ACTIVE_AI_JOB_STORAGE_PREFIX,
  MAX_PROMPT_HISTORY,
} from "./constants";
import type {
  PromptHistoryEntry,
  StoredActiveJob,
} from "./types";

export function buildDefaultAiFileName(toolId: string) {
  const stamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
  const safeTool = String(toolId || "ai").replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80);
  return `Archilya_${safeTool}_${stamp}.png`;
}

import { TOOLS } from "./constants";

export function getToolById(toolId: string) {
  return TOOLS.find((item) => item.id === toolId) || null;
}

export function isDataUrl(value: string) {
  return /^data:/i.test(String(value || ""));
}

export function getMimeAndExtFromImageSource(source: string, fallbackMimeType = "image/png") {
  const header = String(source || "").split(",")[0] || "";
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  const mimeType = mimeMatch?.[1] || fallbackMimeType || "image/png";
  const fallbackExt = (fallbackMimeType.split("/")[1] || "png").toLowerCase();
  const ext = (mimeType.split("/")[1] || fallbackExt || "png").toLowerCase();
  return { mimeType, ext };
}

export async function imageSourceToFile(
  source: string,
  fileName = "ai-output.png",
  fallbackMimeType = "image/png",
  messages: { missingSource: string; downloadFailed: string },
) {
  const normalizedSource = String(source || "").trim();
  if (!normalizedSource) {
    throw new Error(messages.missingSource);
  }

  if (isDataUrl(normalizedSource)) {
    const { mimeType } = getMimeAndExtFromImageSource(normalizedSource, fallbackMimeType);
    const response = await fetch(normalizedSource);
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || mimeType });
  }

  const response = await fetch(normalizedSource);
  if (!response.ok) {
    throw new Error(messages.downloadFailed);
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || fallbackMimeType });
}

export function ensureFileExtension(fileName: string, ext: string) {
  const normalizedExt = String(ext || "").replace(/^\./, "").toLowerCase() || "png";
  const value = String(fileName || "").trim();
  if (!value) return `ai-output.${normalizedExt}`;
  if (value.toLowerCase().endsWith(`.${normalizedExt}`)) return value;
  return `${value}.${normalizedExt}`;
}

export function sanitizePromptHistoryEntry(entry: Partial<PromptHistoryEntry>, fallbackToolId = "") {
  const toolId = String(entry.toolId || fallbackToolId || "").trim().toLowerCase();
  if (!toolId) return null;
  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
    toolId,
    toolLabel: String(entry.toolLabel || toolId).trim().slice(0, 120),
    outputType: entry.outputType === "text" ? "text" : "image",
    style: String(entry.style || "").trim().slice(0, 64),
    sceneEditMode: String(entry.sceneEditMode || "").trim().slice(0, 64),
    referenceCount: Math.max(0, Math.min(20, Math.round(Number(entry.referenceCount || 0) || 0))),
    extraNote: String(entry.extraNote || "").trim().slice(0, 2000),
    generationVariant: String(entry.generationVariant || "").trim().slice(0, 40),
    statusLabel: String(entry.statusLabel || "").trim().slice(0, 120),
    createdAt: String(entry.createdAt || new Date().toISOString()).trim().slice(0, 64),
  } satisfies PromptHistoryEntry;
}

export function sanitizePromptHistoryMap(input: Record<string, unknown> | undefined) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {} as Record<string, PromptHistoryEntry[]>;
  }

  const nextMap: Record<string, PromptHistoryEntry[]> = {};
  Object.entries(input).forEach(([rawToolId, rawEntries]) => {
    const toolId = String(rawToolId || "").trim().toLowerCase();
    if (!toolId || !Array.isArray(rawEntries)) return;
    const safeEntries = rawEntries
      .map((entry) => sanitizePromptHistoryEntry(entry as Partial<PromptHistoryEntry>, toolId))
      .filter((entry): entry is PromptHistoryEntry => Boolean(entry))
      .slice(0, MAX_PROMPT_HISTORY);
    if (safeEntries.length > 0) {
      nextMap[toolId] = safeEntries;
    }
  });
  return nextMap;
}

export function buildActiveJobStorageKey(uid: string) {
  return `${ACTIVE_AI_JOB_STORAGE_PREFIX}:${uid}`;
}

export function readStoredActiveJob(uid: string): StoredActiveJob | null {
  if (typeof window === "undefined" || !uid) return null;

  try {
    const rawValue = window.localStorage.getItem(buildActiveJobStorageKey(uid));
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<StoredActiveJob>;
    const jobId = String(parsed.jobId || "").trim();
    const toolId = String(parsed.toolId || "").trim();
    if (!jobId || !toolId) return null;
    return {
      jobId,
      toolId,
      style: String(parsed.style || "").trim(),
      sceneEditMode: String(parsed.sceneEditMode || "").trim(),
      extraNote: String(parsed.extraNote || "").trim(),
      outputType: parsed.outputType === "text" ? "text" : "image",
      generationVariant: String(parsed.generationVariant || "default").trim() || "default",
      sourceImageUri: String(parsed.sourceImageUri || "").trim(),
    } satisfies StoredActiveJob;
  } catch {
    return null;
  }
}

export function persistActiveJob(uid: string, payload: StoredActiveJob) {
  if (typeof window === "undefined" || !uid) return;
  window.localStorage.setItem(buildActiveJobStorageKey(uid), JSON.stringify(payload));
}

export function clearStoredActiveJob(uid: string) {
  if (typeof window === "undefined" || !uid) return;
  window.localStorage.removeItem(buildActiveJobStorageKey(uid));
}

export function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return new Date().toISOString();
}

export function getFriendlyAIError(
  error: unknown,
  isImage: boolean,
  messages: { permissionImage: string; permissionAnalysis: string; generic: string },
) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const rawCode = String((error as { code?: string })?.code || "").toLowerCase();
  const normalizedMessage = rawMessage.trim();
  const lowerMessage = normalizedMessage.toLocaleLowerCase("tr-TR");
  if (/kredi/i.test(rawMessage)) return rawMessage;
  if (/permission|yetki|auth/i.test(rawMessage)) return isImage ? messages.permissionImage : messages.permissionAnalysis;
  if (rawCode.includes("failed-precondition") || rawCode.includes("resource-exhausted") || rawCode.includes("unavailable")) {
    return normalizedMessage.replace(/gemini|google|replicate/gi, "Archilya AI") || messages.generic;
  }
  if (rawCode.includes("internal") || lowerMessage === "internal" || lowerMessage.includes("functions/internal")) {
    return isImage
      ? "Görsel üretim servisi şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin; devam ederse AI servis yapılandırmasını kontrol edin."
      : messages.generic;
  }
  return rawMessage.replace(/gemini|google|replicate/gi, "Archilya AI") || messages.generic;
}

export function revokeObjectUrlSafe(url: string | null) {
  if (String(url || "").startsWith("blob:")) {
    URL.revokeObjectURL(String(url));
  }
}

export function validateSelectedFile(file: File, contextLabel: string, maxSizeMessage: (contextLabel: string) => string) {
  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error(maxSizeMessage(contextLabel));
  }
  return true;
}
