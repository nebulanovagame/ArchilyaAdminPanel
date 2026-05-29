export type {
  AnalysisDirectives,
  AnalysisFocus,
  ArchitecturalMode,
  ArchitecturalPreservationContract,
  AtmosphereDirective,
  ChangeIntensity,
  CompiledPrompt,
  CompiledPromptMetadata,
  CompiledSection,
  EditableZone,
  EditScope,
  ForbiddenAction,
  ForbiddenActionName,
  GenerationVariant,
  GeometryRisk,
  LockedZone,
  LightQuality,
  LightingDirective,
  LightingIntensity,
  LightingSource,
  LightingType,
  LightingWarmth,
  MaterialDirective,
  MaterialFamily,
  MaterialFinish,
  MaterialQuality,
  MaterialTone,
  PreservationElement,
  PreservationPriority,
  PreservationRule,
  PromptContract,
  ReferenceBrief,
  ReferencePolicy,
  ReferenceType,
  ReportTone,
  SectionPriority,
  ShadowIntensity,
  StyleDirectives,
  TaskDirective,
  TaskType,
  TimeOfDay,
  ToolConstraintBlock,
  ToolConstraintBlock as PromptToolConstraintBlock,
} from "./types";

export { getToolDefaultPreservation } from "./contract/architectural-contract";
export { ContractBuilder } from "./contract/builder";
export { PromptCompiler } from "./compiler/compiler";
export { SECTION_PRIORITY_ORDER } from "./compiler/types";
export type { CompilerConfig, PromptCompilerInterface, SectionBuilder } from "./compiler/types";

// ── Feature Flag ──────────────────────────────────────────
export { isFeatureEnabled, type FeatureFlagName, FEATURE_FLAGS } from "../feature-flags/config";

// ── DSLs ──────────────────────────────────────────────────
export { SceneEditDSL } from "./dsl/sceneedit-dsl";
export { EnhanceDSL } from "./dsl/enhance-dsl";
export { AnalysisDSL } from "./dsl/analysis-dsl";
export { PlanColorDSL } from "./dsl/plancolor-dsl";
export { Img2imgDSL } from "./dsl/img2img-dsl";
export { MultiAngleDSL } from "./dsl/multiangle-dsl";

// ── Providers ─────────────────────────────────────────────
export { GeminiAdapter } from "./providers/gemini-adapter";
export { FluxAdapter } from "./providers/flux-adapter";
export { getProviderAdapter, getAvailableProviders } from "./providers/adapter-registry";

// ── Reference Analyzer ────────────────────────────────────
export { ReferenceAnalyzer } from "./reference-analyzer/analyzer";
export { classifyReferenceType, assessGeometryRisk } from "./reference-analyzer/classifiers";
export { calculateWeight, normalizeWeights } from "./reference-analyzer/weighting";

// ── Settings Normalizer ───────────────────────────────────
export { SettingsNormalizer } from "./settings-normalizer/normalizer";
export { ATMOSPHERE_MAPPINGS, MATERIAL_MAPPINGS, STYLE_STRENGTH_MAPPINGS } from "./settings-normalizer/mappings";

// ── Observability ─────────────────────────────────────────
export { PromptLogger } from "./observability/logger";
