import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ACTIVE_AI_JOB_STORAGE_PREFIX,
  MAX_PROMPT_HISTORY,
} from "./constants";
import { ContractBuilder, ReferenceAnalyzer, SettingsNormalizer } from "@/lib/prompt-engine";
import type { AnalysisFocus, GenerationVariant, PromptContract, ReportTone } from "@/lib/prompt-engine";
import { isFeatureEnabled } from "@/lib/feature-flags/config";
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
      atmosphere: parsed.atmosphere ? String(parsed.atmosphere).trim() : undefined,
      materialLanguage: parsed.materialLanguage ? String(parsed.materialLanguage).trim() : undefined,
      styleStrength: parsed.styleStrength ? String(parsed.styleStrength).trim() : undefined,
      planType: parsed.planType ? String(parsed.planType).trim() : undefined,
      palette: parsed.palette ? String(parsed.palette).trim() : undefined,
      presentationStyle: parsed.presentationStyle ? String(parsed.presentationStyle).trim() : undefined,
      reportTone: parsed.reportTone ? String(parsed.reportTone).trim() : undefined,
      roomLabels: typeof parsed.roomLabels === "boolean" ? parsed.roomLabels : undefined,
      analysisFocus: Array.isArray(parsed.analysisFocus) ? parsed.analysisFocus : undefined,
      multiAnglePreserve: Array.isArray(parsed.multiAnglePreserve) ? parsed.multiAnglePreserve : undefined,
      enhancePreserve: Array.isArray(parsed.enhancePreserve) ? parsed.enhancePreserve : undefined,
      scenePreserveAreas: Array.isArray(parsed.scenePreserveAreas) ? parsed.scenePreserveAreas : undefined,
    } satisfies StoredActiveJob;
  } catch {
    return null;
  }
}

export function persistActiveJob(uid: string, payload: StoredActiveJob) {
  if (typeof window === "undefined" || !uid) return;
  try {
    const serialized = JSON.stringify(payload);
    // Guard against quota exceeded: max ~10KB for stored job
    if (serialized.length > 10240) return;
    window.localStorage.setItem(buildActiveJobStorageKey(uid), serialized);
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function clearStoredActiveJob(uid: string) {
  if (typeof window === "undefined" || !uid) return;
  try {
    window.localStorage.removeItem(buildActiveJobStorageKey(uid));
  } catch {
    // localStorage removed externally or unavailable — silently skip
  }
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

// ── Tool-specific note formatting helpers ────────────────────
// Extracted from use-ai-studio-state.ts handleGenerate() to reduce coupling.
// Pure formatting — no hook dependencies.

export function buildAnalysisNote(
  baseNote: string,
  analysisFocus: string[],
  reportTone: string,
  resolveLabel: (key: string) => string,
): string {
  let note = baseNote;
  if (analysisFocus.length > 0) {
    const focusLabels = analysisFocus.map((f) => resolveLabel(`dashboard.aiStudio.analysis${f.charAt(0).toUpperCase() + f.slice(1)}`)).join(", ");
    note = note ? `${note}\n\nAnaliz odakları: ${focusLabels}.` : `Analiz odakları: ${focusLabels}.`;
  }
  if (reportTone) {
    const toneKeys: Record<string, string> = { professional: "toneProfessional", critical: "toneCritical", constructive: "toneConstructive", detailed: "toneDetailed" };
    const toneLabel = resolveLabel(`dashboard.aiStudio.${toneKeys[reportTone] || "toneProfessional"}`);
    note = note ? `${note}\n\nRapor tonu: ${toneLabel}.` : `Rapor tonu: ${toneLabel}.`;
  }
  return note;
}

export function buildImg2imgNote(
  baseNote: string,
  atmosphere: string,
  materialLanguage: string,
  resolveLabel: (key: string) => string,
): string {
  // Only append tool defaults if user wrote something — otherwise let the
  // reference image speak for itself without forced style directives.
  if (!baseNote) return "";
  const atmKeys: Record<string, string> = {
    "golden-hour": "atmosphereGoldenHour", "natural-daylight": "atmosphereNaturalDaylight",
    twilight: "atmosphereTwilight", "overcast-soft": "atmosphereOvercastSoft",
    "warm-interior": "atmosphereWarmInterior", "cool-modern": "atmosphereCoolModern",
    "dramatic-shadow": "atmosphereDramaticShadow", "sunny-morning": "atmosphereSunnyMorning",
  };
  const matKeys: Record<string, string> = {
    "natural-wood": "materialNaturalWood", "stone-marble": "materialStoneMarble",
    "metal-glass": "materialMetalGlass", "concrete-minimal": "materialConcreteMinimal",
    "warm-textile": "materialWarmTextile", "mixed-premium": "materialMixedPremium",
  };
  const atmLabel = resolveLabel(`dashboard.aiStudio.${atmKeys[atmosphere] || "atmosphereGoldenHour"}`);
  const matLabel = resolveLabel(`dashboard.aiStudio.${matKeys[materialLanguage] || "materialNaturalWood"}`);
  return `${baseNote}\n\nAtmosfer: ${atmLabel}. Malzeme dili: ${matLabel}.`;
}

export function buildEnhanceNote(
  baseNote: string,
  styleStrength: string,
  enhancePreserve: string[],
  resolveLabel: (key: string) => string,
): string {
  if (!baseNote) return "";
  let note = baseNote;
  const strengthKeys: Record<string, string> = { low: "strengthLow", medium: "strengthMedium", high: "strengthHigh" };
  const strengthLabel = resolveLabel(`dashboard.aiStudio.${strengthKeys[styleStrength] || "strengthMedium"}`);
  note = `${note}\n\nStil gücü: ${strengthLabel}.`;
  if (enhancePreserve.length > 0) {
    const preserveKeys: Record<string, string> = {
      perspective: "preservePerspective", massing: "preserveMassing",
      "window-position": "preserveWindowPosition", "furniture-layout": "preserveFurnitureLayout",
      "floor-separation": "preserveFloorSeparation", "ceiling-form": "preserveCeilingForm",
    };
    const preserveLabels = enhancePreserve.map((p) => resolveLabel(`dashboard.aiStudio.${preserveKeys[p] || p}`)).join(", ");
    note = `${note}\n\nKorunacak öğeler: ${preserveLabels}.`;
  }
  return note;
}

export function buildSceneEditNote(
  baseNote: string,
  revisionType: string,
  scenePreserveAreas: string[],
  resolveLabel: (key: string) => string,
): string {
  if (!baseNote && scenePreserveAreas.length === 0) return "";
  let note = baseNote || "";
  if (revisionType) {
    const revisionLabel = resolveLabel(`dashboard.aiStudio.revisionTypes.${revisionType}`);
    note = note ? `${note}\n\nRevizyon alanı: ${revisionLabel}.` : `Revizyon alanı: ${revisionLabel}.`;
  }
  if (scenePreserveAreas.length > 0) {
    const labels: Record<string, string> = {
      perspective: "preservePerspective", massing: "preserveMassing",
      "furniture-layout": "preserveFurnitureLayout", "floor-separation": "preserveFloorSeparation",
    };
    const areaLabels = scenePreserveAreas.map((a) => resolveLabel(`dashboard.aiStudio.${labels[a] || a}`)).join(", ");
    note = note ? `${note}\n\nKorunacak alanlar: ${areaLabels}.` : `Korunacak alanlar: ${areaLabels}.`;
  }
  return note;
}

export function buildMultiAngleNote(
  baseNote: string,
  multiAnglePreserve: string[],
  resolveLabel: (key: string) => string,
): string {
  if (multiAnglePreserve.length === 0) return baseNote;
  const preserveLabels = multiAnglePreserve.map((p) => resolveLabel(`dashboard.aiStudio.multiAngle${p.charAt(0).toUpperCase() + p.slice(1)}`)).join(", ");
  return baseNote
    ? `${baseNote}\n\nKorunacak stil öğeleri: ${preserveLabels}.`
    : `Korunacak stil öğeleri: ${preserveLabels}.`;
}

export function buildPlancolorNote(
  baseNote: string,
  planType: string,
  palette: string,
  presentationStyle: string,
  roomLabels: boolean,
  resolveLabel: (key: string) => string,
): string {
  const planTypeKeys: Record<string, string> = {
    "floor-plan": "planTypeFloor", "site-plan": "planTypeSite",
    section: "planTypeSection", elevation: "planTypeElevation",
  };
  const paletteKeys: Record<string, string> = {
    "warm-premium": "paletteWarmPremium", monochrome: "paletteMonochrome",
    "pastel-architecture": "palettePastel", "luxury-real-estate": "paletteLuxury",
  };
  const presStyleKeys: Record<string, string> = {
    "clean-modern": "presentationClean", "architectural-board": "presentationBoard",
    "real-estate": "presentationRealEstate", "minimal-line": "presentationMinimal",
  };
  const planTypeLabel = resolveLabel(`dashboard.aiStudio.${planTypeKeys[planType] || "planTypeFloor"}`);
  const paletteLabel = resolveLabel(`dashboard.aiStudio.${paletteKeys[palette] || "paletteWarmPremium"}`);
  const presStyleLabel = resolveLabel(`dashboard.aiStudio.${presStyleKeys[presentationStyle] || "presentationClean"}`);
  const rooms = roomLabels ? "göster" : "gizle";
  return baseNote
    ? `${baseNote}\n\nPlan türü: ${planTypeLabel}. Renk paleti: ${paletteLabel}. Sunum stili: ${presStyleLabel}. Oda etiketleri: ${rooms}.`
    : `Plan türü: ${planTypeLabel}. Renk paleti: ${paletteLabel}. Sunum stili: ${presStyleLabel}. Oda etiketleri: ${rooms}.`;
}

export function buildToolNote(
  toolId: string,
  baseNote: string,
  params: {
    analysisFocus?: string[];
    reportTone?: string;
    revisionType?: string;
    scenePreserveAreas?: string[];
    atmosphere?: string;
    materialLanguage?: string;
    styleStrength?: string;
    enhancePreserve?: string[];
    multiAnglePreserve?: string[];
    planType?: string;
    palette?: string;
    presentationStyle?: string;
    roomLabels?: boolean;
  },
  resolveLabel: (key: string) => string,
): string {
  let note = baseNote;
  if (toolId === "analysis") {
    note = buildAnalysisNote(note, params.analysisFocus || [], params.reportTone || "professional", resolveLabel);
  }
  if (toolId === "multi-angle") {
    note = buildMultiAngleNote(note, params.multiAnglePreserve || [], resolveLabel);
  }
  if (toolId === "sceneedit") {
    note = buildSceneEditNote(note, params.revisionType || "general", params.scenePreserveAreas || [], resolveLabel);
  }
  if (toolId === "img2img") {
    note = buildImg2imgNote(note, params.atmosphere || "golden-hour", params.materialLanguage || "natural-wood", resolveLabel);
  }
  if (toolId === "enhance") {
    note = buildEnhanceNote(note, params.styleStrength || "medium", params.enhancePreserve || [], resolveLabel);
  }
  if (toolId === "plancolor") {
    note = buildPlancolorNote(note, params.planType || "floor-plan", params.palette || "warm-premium", params.presentationStyle || "clean-modern", params.roomLabels ?? true, resolveLabel);
  }
  return note;
}

type ToolContractParams = {
  analysisFocus?: string[];
  reportTone?: string;
  revisionType?: string;
  scenePreserveAreas?: string[];
  atmosphere?: string;
  materialLanguage?: string;
  styleStrength?: string;
  enhancePreserve?: string[];
  multiAnglePreserve?: string[];
  planType?: string;
  palette?: string;
  presentationStyle?: string;
  roomLabels?: boolean;
  extraNote?: string;
  style?: string;
  sceneEditMode?: string;
  generationVariant?: string;
  sceneReferences?: Array<{ type?: string; label?: string; note?: string }>;
};

const PROMPT_CONTRACT_TOOL_IDS = ["analysis", "img2img", "enhance", "sceneedit", "plancolor", "multi-angle"] as const;
const ANALYSIS_FOCUS_VALUES = ["material", "light", "composition", "function", "presentation", "revision"] as const;
const REPORT_TONE_VALUES = ["professional", "critical", "constructive", "detailed"] as const;

function normalizePromptContractToolId(toolId: string): PromptContract["toolId"] | null {
  return PROMPT_CONTRACT_TOOL_IDS.includes(toolId as PromptContract["toolId"])
    ? (toolId as PromptContract["toolId"])
    : null;
}

function normalizeContractVariant(value: string | undefined): GenerationVariant {
  return value === "variation" || value === "retry" ? value : "default";
}

function normalizeContractAnalysisFocus(values: string[] | undefined): AnalysisFocus[] {
  return (Array.isArray(values) ? values : []).filter((value): value is AnalysisFocus =>
    ANALYSIS_FOCUS_VALUES.includes(value as AnalysisFocus),
  );
}

function normalizeContractReportTone(value: string | undefined): ReportTone {
  return REPORT_TONE_VALUES.includes(value as ReportTone) ? (value as ReportTone) : "professional";
}

function resolveContractOptionLabel(resolveLabel: (key: string) => string, key: string) {
  return resolveLabel(`dashboard.aiStudio.${key}`);
}

export function resolveToolContractLabel(toolId: string) {
  const labels: Record<string, string> = {
    analysis: "V3 architectural analysis prompt contract",
    img2img: "V3 architectural render transformation prompt contract",
    enhance: "V3 render enhancement prompt contract",
    sceneedit: "V3 surgical scene edit prompt contract",
    plancolor: "V3 plan colorization prompt contract",
    "multi-angle": "V3 multi-angle generation prompt contract",
  };

  return labels[toolId] || "V3 AI Studio prompt contract";
}

function buildContractToolConstraints(
  toolId: PromptContract["toolId"],
  params: ToolContractParams,
  resolveLabel: (key: string) => string,
) {
  const constraints: Record<string, unknown> = {
    contractLabel: resolveToolContractLabel(toolId),
  };

  if (params.extraNote) constraints.userNotePresent = true;
  if (params.style) constraints.architecturalStyle = params.style;

  if (toolId === "analysis") {
    constraints.analysisFocus = normalizeContractAnalysisFocus(params.analysisFocus);
    constraints.reportTone = normalizeContractReportTone(params.reportTone);
  }

  if (toolId === "sceneedit") {
    const revisionType = params.revisionType || "general";
    constraints.sceneEditMode = params.sceneEditMode || "scene-compose";
    constraints.revisionType = revisionType;
    constraints.revisionTypeLabel = resolveLabel(`dashboard.aiStudio.revisionTypes.${revisionType}`);
    constraints.preserveAreas = params.scenePreserveAreas || [];
  }

  if (toolId === "img2img") {
    const atmosphere = params.atmosphere || "golden-hour";
    const materialLanguage = params.materialLanguage || "natural-wood";
    constraints.atmosphere = atmosphere;
    constraints.materialLanguage = materialLanguage;
    constraints.atmosphereLabel = resolveContractOptionLabel(resolveLabel, {
      "golden-hour": "atmosphereGoldenHour",
      "natural-daylight": "atmosphereNaturalDaylight",
      twilight: "atmosphereTwilight",
      "overcast-soft": "atmosphereOvercastSoft",
      "warm-interior": "atmosphereWarmInterior",
      "cool-modern": "atmosphereCoolModern",
      "dramatic-shadow": "atmosphereDramaticShadow",
      "sunny-morning": "atmosphereSunnyMorning",
    }[atmosphere] || "atmosphereGoldenHour");
    constraints.materialLanguageLabel = resolveContractOptionLabel(resolveLabel, {
      "natural-wood": "materialNaturalWood",
      "stone-marble": "materialStoneMarble",
      "metal-glass": "materialMetalGlass",
      "concrete-minimal": "materialConcreteMinimal",
      "warm-textile": "materialWarmTextile",
      "mixed-premium": "materialMixedPremium",
    }[materialLanguage] || "materialNaturalWood");
  }

  if (toolId === "enhance") {
    constraints.styleStrength = params.styleStrength || "medium";
    constraints.preserveElements = params.enhancePreserve || [];
  }

  if (toolId === "multi-angle") {
    constraints.preserveStyleElements = params.multiAnglePreserve || [];
  }

  if (toolId === "plancolor") {
    constraints.planType = params.planType || "floor-plan";
    constraints.palette = params.palette || "warm-premium";
    constraints.presentationStyle = params.presentationStyle || "clean-modern";
    constraints.roomLabels = params.roomLabels ?? true;
  }

  return constraints;
}

function buildContractTask(toolId: PromptContract["toolId"], params: ToolContractParams) {
  if (toolId === "sceneedit") {
    return {
      primaryGoal: `Apply ${params.revisionType || params.sceneEditMode || "targeted"} edits to the requested scene areas only`,
      editScope: "surgical" as const,
    };
  }

  if (toolId === "plancolor") {
    return {
      primaryGoal: `Colorize ${params.planType || "floor-plan"} with ${params.presentationStyle || "clean-modern"} presentation`,
    };
  }

  return undefined;
}

function buildContractPreservation(toolId: PromptContract["toolId"], params: ToolContractParams): Partial<PromptContract["architecturalPreservation"]> | undefined {
  if (toolId !== "sceneedit") return undefined;

  const revisionType = params.revisionType || "Requested edit zone";
  return {
    editableZones: [
      {
        name: revisionType,
        allowedChanges: [params.sceneEditMode || "scene-compose", revisionType],
        maxChangeIntensity: "moderate",
      },
    ],
  };
}

function buildContractColorPalette(params: ToolContractParams, resolveLabel: (key: string) => string) {
  if (!params.palette) return undefined;
  const paletteKeys: Record<string, string> = {
    "warm-premium": "paletteWarmPremium",
    monochrome: "paletteMonochrome",
    "pastel-architecture": "palettePastel",
    "luxury-real-estate": "paletteLuxury",
  };
  return [resolveContractOptionLabel(resolveLabel, paletteKeys[params.palette] || "paletteWarmPremium")];
}

export function buildToolContract(
  toolId: string,
  params: ToolContractParams,
  resolveLabel: (key: string) => string,
): PromptContract | null {
  try {
    if (!isFeatureEnabled("promptEngineV3")) return null;

    const normalizedToolId = normalizePromptContractToolId(toolId);
    if (!normalizedToolId) return null;

    const builder = new ContractBuilder();
    const normalizer = new SettingsNormalizer();
    const referenceAnalyzer = new ReferenceAnalyzer();
    const normalizedStyle = normalizer.normalize({
      atmosphere: params.atmosphere,
      materialLanguage: params.materialLanguage,
      styleStrength: params.styleStrength,
    });
    const references = referenceAnalyzer.analyzeMultiple(
      (params.sceneReferences || []).map((reference) => ({
        type: reference.type,
        label: reference.label,
        note: reference.note,
        toolId: normalizedToolId,
      })),
      normalizedToolId,
    );
    const task = buildContractTask(normalizedToolId, params);
    const preservation = buildContractPreservation(normalizedToolId, params);
    const colorPalette = buildContractColorPalette(params, resolveLabel);
    const style = {
      ...(params.style ? { architecturalStyle: params.style } : {}),
      ...(normalizedStyle.atmosphere ? { atmosphere: normalizedStyle.atmosphere } : {}),
      ...(normalizedStyle.materialLanguage ? { materialLanguage: normalizedStyle.materialLanguage } : {}),
      ...(normalizedStyle.lightingStyle ? { lightingStyle: normalizedStyle.lightingStyle } : {}),
      ...(normalizedStyle.styleStrength !== undefined ? { styleStrength: normalizedStyle.styleStrength } : {}),
      ...(colorPalette ? { colorPalette } : {}),
    };
    const analysisFocus = normalizeContractAnalysisFocus(params.analysisFocus);
    const analysisDirectives = normalizedToolId === "analysis"
      ? {
          ...(analysisFocus.length > 0 ? { focus: analysisFocus } : {}),
          tone: normalizeContractReportTone(params.reportTone),
          depth: params.reportTone === "detailed" ? "deep" as const : "moderate" as const,
        }
      : undefined;

    return builder.build({
      toolId: normalizedToolId,
      ...(task ? { task } : {}),
      ...(preservation ? { preservation } : {}),
      style,
      references,
      toolConstraints: buildContractToolConstraints(normalizedToolId, params, resolveLabel),
      ...(analysisDirectives ? { analysisDirectives } : {}),
      variant: normalizeContractVariant(params.generationVariant),
      ...(params.extraNote ? { userNote: params.extraNote } : {}),
    });
  } catch {
    return null;
  }
}

// ── UI State Helpers (extracted from page.tsx for FAZ1 cleanup) ──

export interface ActiveJobInfo {
  status: string;
  progressMessage?: string;
}

/**
 * Maps job status + progress message to a processing step index (0-4).
 * UI-only presentation helper — no business logic.
 */
export function deriveProcessingStep(
  submittingJob: boolean,
  activeJob: ActiveJobInfo,
): number {
  if (submittingJob || activeJob.status === "queued") return 0; // prepare
  if (activeJob.status === "running") {
    const msg = String(activeJob.progressMessage || "").toLowerCase();
    if (msg.includes("hazırl") || msg.includes("prepar")) return 0;
    if (msg.includes("prompt") || msg.includes("oluştur")) return 1;
    if (msg.includes("işlen") || msg.includes("process")) return 3;
    return 2; // generate (default for running)
  }
  if (activeJob.status === "completed") return 4; // preview
  return 0;
}

export type CanvasStateName = "welcome" | "upload" | "preview" | "processing" | "result" | "result-text";

export interface CanvasDerivationInput {
  selectedTool: unknown;
  generating: boolean;
  hasPrimarySource: boolean;
  hasResultImage: boolean;
  hasResultText: boolean;
}

/**
 * Computes the current canvas state based on tool selection and job state.
 * UI-only presentation helper — no business logic.
 */
export function deriveCanvasState(input: CanvasDerivationInput): CanvasStateName {
  if (!input.selectedTool) return "welcome";
  if (input.generating) return "processing";
  if (input.hasResultImage) return "result";
  if (input.hasResultText) return "result-text";
  if (input.hasPrimarySource) return "preview";
  return "upload";
}

// ── Tool Label / Message Helpers ──────────────────────────────
// Extracted from use-ai-studio-state.ts for FAZ1 cleanup.
// Pure display helpers — no hook dependencies.

export type ToolLike = {
  id: string;
  outputType: "text" | "image";
};

type ResolveLabel = (key: string, values?: Record<string, unknown>) => string;

export function resolveToolLabel(tool: ToolLike, resolveLabel: ResolveLabel): string {
  return resolveLabel(`dashboard.aiStudio.tools.${tool.id}.label`);
}

export function resolveLoadingMessage(tool: ToolLike, resolveLabel: ResolveLabel): string {
  const toolLabel = resolveToolLabel(tool, resolveLabel);
  if (tool.id === "plancolor") return resolveLabel("dashboard.aiStudio.processingMinutes", { tool: toolLabel });
  if (tool.id === "sceneedit") return resolveLabel("dashboard.aiStudio.processingSecondsLong", { tool: toolLabel });
  if (tool.outputType === "image") return resolveLabel("dashboard.aiStudio.processingSeconds", { tool: toolLabel });
  return resolveLabel("dashboard.aiStudio.preparingSeconds", { tool: toolLabel });
}

export function resolveSuccessMessage(tool: ToolLike, resolveLabel: ResolveLabel): string {
  const toolLabel = resolveToolLabel(tool, resolveLabel);
  return resolveLabel("dashboard.aiStudio.toolCompleted", { tool: toolLabel });
}
