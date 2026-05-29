// ── Prompt Engine V3 — Core Types ────────────────────────────
// These types form the contract between all V3 layers:
//   Contract → Compiler → Provider Adapter → Final Prompt
//
// Import from @/lib/ai-studio/tools for AiStudioToolId

import type { AiStudioToolId } from "@/lib/ai-studio/tools";

// ═══════════════════════════════════════════════════════════════
// Task Directives
// ═══════════════════════════════════════════════════════════════

export type TaskType =
  | "architectural-render"
  | "style-transfer"
  | "scene-edit"
  | "multi-angle"
  | "analysis"
  | "plan-color";

export type ArchitecturalMode = "preserve" | "enhance" | "edit" | "analyze";

export type EditScope = "full" | "surgical";

export interface TaskDirective {
  type: TaskType;
  primaryGoal: string;
  architecturalMode: ArchitecturalMode;
  editScope?: EditScope;
}

// ═══════════════════════════════════════════════════════════════
// Preservation Contract
// ═══════════════════════════════════════════════════════════════

export type PreservationElement =
  | "camera-transform"
  | "architectural-topology"
  | "window-coordinates"
  | "wall-graph"
  | "room-boundaries"
  | "massing"
  | "ceiling-height"
  | "opening-placement"
  | "furniture-layout"
  | "floor-separation"
  | "perspective"
  | "composition";

export type PreservationPriority = "critical" | "high" | "medium";

export interface PreservationRule {
  element: PreservationElement;
  priority: PreservationPriority;
  description: string;
}

export type ForbiddenActionName =
  | "redesign-architecture"
  | "reinterpret-layout"
  | "hallucinate-openings"
  | "alter-room-proportions"
  | "change-geometry"
  | "add-windows"
  | "remove-structural-elements"
  | "change-camera-angle";

export interface ForbiddenAction {
  action: ForbiddenActionName;
  scope: "global";
  severity: "blocking";
}

export interface LockedZone {
  name: string;
  reason: string;
}

export type ChangeIntensity = "subtle" | "moderate" | "significant";

export interface EditableZone {
  name: string;
  allowedChanges: string[];
  maxChangeIntensity: ChangeIntensity;
}

export interface ArchitecturalPreservationContract {
  mandatory: PreservationRule[];
  preferred: PreservationRule[];
  forbidden: ForbiddenAction[];
  lockedZones: LockedZone[];
  editableZones: EditableZone[];
}

// ═══════════════════════════════════════════════════════════════
// Style Directives
// ═══════════════════════════════════════════════════════════════

export type TimeOfDay =
  | "golden-hour"
  | "midday"
  | "twilight"
  | "overcast"
  | "morning"
  | "night"
  | "unspecified";

export type LightQuality = "warm" | "cool" | "neutral" | "dramatic";

export type InteriorExterior = "interior" | "exterior" | "unspecified";

export type ShadowIntensity = "soft" | "medium" | "hard";

export interface AtmosphereDirective {
  timeOfDay: TimeOfDay;
  lightQuality: LightQuality;
  interiorExterior: InteriorExterior;
  shadowIntensity: ShadowIntensity;
}

export type MaterialFamily = "wood" | "stone" | "metal" | "glass" | "concrete" | "textile" | "mixed";

export type MaterialTone = "warm" | "cool" | "neutral";

export type MaterialFinish = "matte" | "satin" | "glossy" | "natural";

export type MaterialQuality = "premium" | "standard";

export interface MaterialDirective {
  primaryMaterialFamily: MaterialFamily;
  tone: MaterialTone;
  finish: MaterialFinish;
  quality: MaterialQuality;
}

export type LightingType = "natural" | "artificial" | "mixed";
export type LightingWarmth = "warm" | "neutral" | "cool";
export type LightingIntensity = "bright" | "moderate" | "dim" | "dramatic";
export type LightingSource = "sunlight" | "ambient" | "task" | "accent" | "recessed" | "pendant";

export interface LightingDirective {
  type: LightingType;
  warmth: LightingWarmth;
  intensity: LightingIntensity;
  source: LightingSource;
}

export interface StyleDirectives {
  architecturalStyle?: string;
  atmosphere?: AtmosphereDirective;
  materialLanguage?: MaterialDirective;
  lightingStyle?: LightingDirective;
  styleStrength?: number; // 0.0–1.0
  colorPalette?: string[];
}

// ═══════════════════════════════════════════════════════════════
// Reference Policy
// ═══════════════════════════════════════════════════════════════

export type ReferenceType = "style" | "material" | "object" | "lighting" | "layout" | "scene";

export type GeometryRisk = "low" | "medium" | "high";

export interface ReferenceBrief {
  id: string;
  type: ReferenceType;
  weight: number; // 0.0–1.0
  geometryRisk: GeometryRisk;
  allowedTransfer: string[];
  forbiddenTransfer: string[];
  styleSummary?: string;
  materialSummary?: string;
  lightingSummary?: string;
  objectSummary?: string;
}

export interface ReferencePolicy {
  references: ReferenceBrief[];
  defaultBehavior: "style-and-material-only";
}

// ═══════════════════════════════════════════════════════════════
// Tool Constraint Block (DSL output)
// ═══════════════════════════════════════════════════════════════

export interface ToolConstraintBlock {
  toolId: string;
  dslVersion: string;
  constraints: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// Analysis Directives
// ═══════════════════════════════════════════════════════════════

export type AnalysisFocus =
  | "material"
  | "light"
  | "composition"
  | "function"
  | "presentation"
  | "revision";

export type ReportTone = "professional" | "critical" | "constructive" | "detailed";

export interface AnalysisDirectives {
  focus: AnalysisFocus[];
  tone: ReportTone;
  depth: "superficial" | "moderate" | "deep";
}

// ═══════════════════════════════════════════════════════════════
// Prompt Contract
// ═══════════════════════════════════════════════════════════════

export type GenerationVariant = "default" | "variation" | "retry";

export interface PromptContract {
  version: "3.0.0";
  toolId: AiStudioToolId;
  task: TaskDirective;
  architecturalPreservation: ArchitecturalPreservationContract;
  styleDirectives: StyleDirectives;
  referencePolicy: ReferencePolicy;
  toolConstraints: ToolConstraintBlock;
  analysisDirectives?: AnalysisDirectives;
  variant: GenerationVariant;
  userNote?: string;
}

// ═══════════════════════════════════════════════════════════════
// Compiled Prompt (Compiler Output)
// ═══════════════════════════════════════════════════════════════

export type SectionPriority = "critical" | "high" | "medium" | "low" | "informational";

export interface CompiledSection {
  id: string;
  priority: SectionPriority;
  heading: string;
  body: string;
  tokens: number;
  order: number;
}

export interface CompiledPrompt {
  version: string;
  compilerVersion: string;
  sections: CompiledSection[];
  metadata: CompiledPromptMetadata;
}

export interface CompiledPromptMetadata {
  contractHash: string;
  compiledAt: string;
  toolId: string;
  sectionCount: number;
  totalTokens: number;
}

// ═══════════════════════════════════════════════════════════════
// Provider Types
// ═══════════════════════════════════════════════════════════════

export type ProviderName = "gemini" | "flux" | "openai" | "replicate";

export type ProviderFeature = "multi-image" | "system-prompt" | "negative-prompt" | "image-mask";

export interface InlineImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export interface ProviderPrompt {
  provider: ProviderName;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  negativePrompt?: string;
  imagePrompt?: InlineImagePart[];
  parameters?: Record<string, unknown>;
  sections: CompiledSection[];
  promptVersion: string;
}

export interface ProviderFormatOptions {
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

// ═══════════════════════════════════════════════════════════════
// Settings Normalization
// ═══════════════════════════════════════════════════════════════

export interface NormalizedSetting {
  id: string; // original English ID (e.g., "golden-hour")
  labelKey: string; // i18n key (e.g., "atmosphereGoldenHour")
  directive: AtmosphereDirective | MaterialDirective | LightingDirective | Record<string, unknown>;
}

export interface NormalizedSettings {
  atmosphere?: AtmosphereDirective;
  materialLanguage?: MaterialDirective;
  lightingStyle?: LightingDirective;
  styleStrength?: number;
  colorPalette?: string[];
  architecturalStyle?: string;
  meta: Record<string, string>; // Original UI labels for debugging
}

// ═══════════════════════════════════════════════════════════════
// Observability
// ═══════════════════════════════════════════════════════════════

export interface PromptLog {
  jobId: string;
  promptVersion: string;
  compilerVersion: string;
  contractHash: string;
  contractSnapshot: PromptContract;
  compiledSections: CompiledSection[];
  providerAdapter: ProviderName;
  finalPrompt: ProviderPrompt;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// DSL Types
// ═══════════════════════════════════════════════════════════════

export interface ToolDSL<T extends Record<string, unknown> = Record<string, unknown>> {
  toolId: string;
  dslVersion: string;
  buildConstraints(params: T): ToolConstraintBlock;
}

// ═══════════════════════════════════════════════════════════════
// Provider Adapter Interface
// ═══════════════════════════════════════════════════════════════

export interface ProviderAdapter {
  readonly provider: ProviderName;
  readonly version: string;

  format(compiled: CompiledPrompt, options?: ProviderFormatOptions): ProviderPrompt;
  getMaxTokens(model?: string): number;
  supports(feature: ProviderFeature): boolean;
}

// ═══════════════════════════════════════════════════════════════
// Compiler Interface
// ═══════════════════════════════════════════════════════════════

export interface PromptCompiler {
  readonly version: string;
  compile(contract: PromptContract): CompiledPrompt;
}

// ═══════════════════════════════════════════════════════════════
// Contract Builder Input
// ═══════════════════════════════════════════════════════════════

export interface ContractBuilderInput {
  toolId: AiStudioToolId;
  task?: Partial<TaskDirective>;
  preservation?: Partial<ArchitecturalPreservationContract>;
  style?: Partial<StyleDirectives>;
  references?: ReferenceBrief[];
  toolConstraints?: Record<string, unknown>;
  analysisDirectives?: Partial<AnalysisDirectives>;
  variant?: GenerationVariant;
  userNote?: string;
}
