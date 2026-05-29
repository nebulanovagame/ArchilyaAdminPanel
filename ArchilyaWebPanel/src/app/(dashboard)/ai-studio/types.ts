import type { ComponentType } from "react";
import type { ProjectRecord } from "@/lib/projects/types";

// ── Core Tool Types ──────────────────────────────────────────

export type ToolId = "analysis" | "img2img" | "enhance" | "sceneedit" | "plancolor" | "multi-angle";

export type ToolCategoryId = "render" | "analyze" | "present";

export type ToolCategory = {
  id: ToolCategoryId;
  labelKey: string; // i18n key suffix
};

export type ToolConfig = {
  /** Backend tool ID — never change this */
  id: ToolId;
  /** Display icon (lucide) */
  icon: ComponentType<{ className?: string }>;
  /** Category this tool belongs to */
  category: ToolCategoryId;
  /** Credit cost */
  credit: number;
  /** Whether this tool has a style selector */
  hasStyle: boolean;
  /** Output type */
  outputType: "text" | "image";
  /** i18n key prefix for labels/descriptions: dashboard.aiStudio.tools.{id}.label / .desc */
  /** Frontend display config */
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  /** Whether this tool is a signature Archilya capability — gets hero treatment in tool rail */
  isSignature?: boolean;
};

export type StyleOption = {
  id: string;
  label: string;
  /** Lucide icon name for the style picker (no emoji!) */
  iconName: string;
  /** Subtle swatch color (hex) */
  swatch: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
};

// ── Settings Panel Types ─────────────────────────────────────

export type SettingsFieldType = "style" | "sceneMode" | "referenceImage" | "textarea" | "select" | "checkbox" | "checklist" | "atmosphere" | "material" | "styleStrength" | "preservedAreas" | "planType" | "palette" | "roomLabels" | "presentationStyle" | "reportTone" | "infoNote";

export type SettingsField = {
  type: SettingsFieldType;
  /** i18n key for the field label */
  labelKey: string;
  /** Placeholder i18n key (for textarea) */
  placeholderKey?: string;
  /** Options for select/checklist fields */
  options?: Array<{ id: string; labelKey: string }>;
  /** Default value */
  defaultValue?: string | number | boolean | string[];
  /** Min/max for slider fields */
  min?: number;
  max?: number;
};

export type ToolSettingsConfig = {
  fields: SettingsField[];
  /** Whether the generate button should show extra info */
  showCreditInfo: boolean;
  /** Whether this tool needs a reference image as primary input */
  needsPrimaryImage: boolean;
  /** Whether this tool needs scene references */
  needsSceneReferences: boolean;
};

// ── Canvas States ────────────────────────────────────────────

export type CanvasState =
  | "idle"        // Tool selected, no image
  | "welcome"     // No tool selected
  | "upload"      // Tool selected, no image
  | "preview"     // Image loaded
  | "processing"  // Job running
  | "result"      // Result ready
  | "result-text"; // Text result ready

// ── Existing Types (preserved) ───────────────────────────────

export type PromptHistoryEntry = {
  id: string;
  toolId: string;
  toolLabel: string;
  outputType: "text" | "image";
  style: string;
  sceneEditMode: string;
  referenceCount: number;
  extraNote: string;
  generationVariant: string;
  statusLabel: string;
  createdAt: string;
};

export type ResultImage = {
  src: string;
  mimeType: string;
};

export type ResultMeta = Omit<PromptHistoryEntry, "statusLabel">;

export type ResultRevisionStep = {
  src: string;
  mimeType: string;
  meta: ResultMeta | null;
};

export type ActiveJobDraft = ResultMeta & {
  sourceImageUri: string;
};

export type StoredActiveJob = {
  jobId: string;
  toolId: string;
  style: string;
  sceneEditMode: string;
  extraNote: string;
  outputType: "text" | "image";
  generationVariant: string;
  sourceImageUri: string;
  atmosphere?: string;
  materialLanguage?: string;
  styleStrength?: string;
  planType?: string;
  palette?: string;
  presentationStyle?: string;
  reportTone?: string;
  roomLabels?: boolean;
  analysisFocus?: string[];
  multiAnglePreserve?: string[];
  enhancePreserve?: string[];
  scenePreserveAreas?: string[];
};

export type SceneReference = {
  id: string;
  file: File | null;
  url: string;
  label: string;
  note: string;
  type: string;
};

export type GenerateOptions = {
  extraNoteOverride?: string;
  generationVariant?: string;
};

export type AiStudioPageDependencies = {
  currentUser: { uid: string; email: string | null; displayName: string | null } | null;
  ownerName: string;
  credits: number | null;
  hasEnough: (amount: number) => boolean;
  projects: ProjectRecord[];
  refreshProjects: () => Promise<void>;
  updatePoolStorage: (bytesDelta: number) => Promise<void>;
};

// ── Processing Step ──────────────────────────────────────────

export type ProcessingStep = {
  id: string;
  labelKey: string;
  status: "pending" | "active" | "done";
};
