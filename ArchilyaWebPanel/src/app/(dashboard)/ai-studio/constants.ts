import {
  Sparkles,
  Image,
  Wand2,
  Layers,
  LayoutDashboard,
  Sun,
  Building2,
  Palette,
  ScanLine,
  Camera,
  FileEdit,
  SplitSquareHorizontal,
} from "lucide-react";

import type { ToolConfig, StyleOption, ToolCategory, ToolSettingsConfig } from "./types";

// ── Tool Categories ──────────────────────────────────────────

export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: "render", labelKey: "categoryRender" },
  { id: "analyze", labelKey: "categoryAnalyze" },
  { id: "present", labelKey: "categoryPresent" },
];

export const CREDIT_TO_TL_RATE = 0.7;

// ── Active Tools ─────────────────────────────────────────────
// Tool IDs (id field) are BACKEND CONTRACTS — never change them.
// Display names are mapped through i18n: dashboard.aiStudio.tools.{id}.label

export const TOOLS: readonly ToolConfig[] = [
  // ── RENDER CATEGORY ──
  {
    id: "img2img",
    icon: Image,
    category: "render",
    credit: 15,
    hasStyle: true,
    outputType: "image",
    accentColor: "text-amber-300",
    accentBg: "bg-amber-400/8",
    accentBorder: "border-amber-400/20",
  },
  {
    id: "enhance",
    icon: Wand2,
    category: "render",
    credit: 15,
    hasStyle: false,
    outputType: "image",
    accentColor: "text-violet-300",
    accentBg: "bg-violet-400/8",
    accentBorder: "border-violet-400/20",
  },
  {
    id: "sceneedit",
    icon: FileEdit,
    category: "render",
    credit: 25,
    hasStyle: false,
    outputType: "image",
    accentColor: "text-cyan-300",
    accentBg: "bg-cyan-400/8",
    accentBorder: "border-cyan-400/20",
    isSignature: true,
  },
  {
    id: "multi-angle",
    icon: SplitSquareHorizontal,
    category: "render",
    credit: 15,
    hasStyle: false,
    outputType: "image",
    accentColor: "text-sky-300",
    accentBg: "bg-sky-400/8",
    accentBorder: "border-sky-400/20",
    isSignature: true,
  },
  // ── ANALYZE CATEGORY ──
  {
    id: "analysis",
    icon: ScanLine,
    category: "analyze",
    credit: 5,
    hasStyle: false,
    outputType: "text",
    accentColor: "text-emerald-300",
    accentBg: "bg-emerald-400/8",
    accentBorder: "border-emerald-400/20",
  },
  // ── PRESENT CATEGORY ──
  {
    id: "plancolor",
    icon: Palette,
    category: "present",
    credit: 15,
    hasStyle: true,
    outputType: "image",
    accentColor: "text-rose-300",
    accentBg: "bg-rose-400/8",
    accentBorder: "border-rose-400/20",
  },
] as const;

// ── Coming Soon Tools ────────────────────────────────────────

export interface ComingSoonTool {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  category: "render" | "analyze" | "present";
}

export const COMING_SOON: ComingSoonTool[] = [
  { id: "presentation", icon: LayoutDashboard, color: "text-blue-400", category: "present" },
  { id: "climate", icon: Sun, color: "text-orange-400", category: "analyze" },
  { id: "exploded", icon: Building2, color: "text-indigo-400", category: "present" },
  { id: "concept", icon: Layers, color: "text-rose-400", category: "present" },
];

// ── Tool Settings Configs (Right Panel) ──────────────────────
// Defines which fields appear in the right settings panel per tool

export const TOOL_SETTINGS: Record<string, ToolSettingsConfig> = {
  analysis: {
    needsPrimaryImage: true,
    needsSceneReferences: false,
    showCreditInfo: true,
    fields: [
      { type: "checklist", labelKey: "analysisFocus", options: [
        { id: "material", labelKey: "analysisMaterial" },
        { id: "light", labelKey: "analysisLight" },
        { id: "composition", labelKey: "analysisComposition" },
        { id: "function", labelKey: "analysisFunction" },
        { id: "presentation", labelKey: "analysisPresentation" },
        { id: "revision", labelKey: "analysisRevision" },
      ]},
      { type: "reportTone", labelKey: "reportToneTitle" },
      { type: "textarea", labelKey: "extraNote", placeholderKey: "analysisNote" },
    ],
  },
  img2img: {
    needsPrimaryImage: true,
    needsSceneReferences: false,
    showCreditInfo: true,
    fields: [
      { type: "style", labelKey: "architecturalStyle" },
      { type: "atmosphere", labelKey: "atmosphereTitle" },
      { type: "material", labelKey: "materialTitle" },
      { type: "textarea", labelKey: "extraNote", placeholderKey: "img2imgNote" },
    ],
  },
  enhance: {
    needsPrimaryImage: true,
    needsSceneReferences: false,
    showCreditInfo: true,
    fields: [
      { type: "styleStrength", labelKey: "styleStrengthTitle" },
      { type: "checklist", labelKey: "preserveElements", options: [
        { id: "perspective", labelKey: "preservePerspective" },
        { id: "massing", labelKey: "preserveMassing" },
        { id: "window-position", labelKey: "preserveWindowPosition" },
        { id: "furniture-layout", labelKey: "preserveFurnitureLayout" },
        { id: "floor-separation", labelKey: "preserveFloorSeparation" },
        { id: "ceiling-form", labelKey: "preserveCeilingForm" },
      ]},
      { type: "textarea", labelKey: "extraNote", placeholderKey: "enhanceNote" },
    ],
  },
  sceneedit: {
    needsPrimaryImage: true,
    needsSceneReferences: true,
    showCreditInfo: true,
    fields: [
      { type: "sceneMode", labelKey: "editMode" },
      { type: "referenceImage", labelKey: "addReference" },
      { type: "checklist", labelKey: "preserveAreas", options: [
        { id: "perspective", labelKey: "preservePerspective" },
        { id: "massing", labelKey: "preserveMassing" },
        { id: "furniture-layout", labelKey: "preserveFurnitureLayout" },
        { id: "floor-separation", labelKey: "preserveFloorSeparation" },
      ]},
      { type: "textarea", labelKey: "extraNote", placeholderKey: "sceneeditNote" },
    ],
  },
  "multi-angle": {
    needsPrimaryImage: true,
    needsSceneReferences: false,
    showCreditInfo: true,
    fields: [
      { type: "referenceImage", labelKey: "multiAnglePreviousRender" },
      { type: "checklist", labelKey: "multiAnglePreserve", options: [
        { id: "wood", labelKey: "multiAngleWood" },
        { id: "metal", labelKey: "multiAngleMetal" },
        { id: "lighting", labelKey: "multiAngleLighting" },
        { id: "furniture", labelKey: "multiAngleFurniture" },
        { id: "wall", labelKey: "multiAngleWall" },
        { id: "atmosphere", labelKey: "multiAngleAtmosphere" },
      ]},
      { type: "infoNote", labelKey: "multiAngleLiteInfo" },
      { type: "textarea", labelKey: "extraNote", placeholderKey: "multiAngleNote" },
    ],
  },
  plancolor: {
    needsPrimaryImage: true,
    needsSceneReferences: false,
    showCreditInfo: true,
    fields: [
      { type: "planType", labelKey: "planTypeTitle" },
      { type: "palette", labelKey: "paletteTitle" },
      { type: "roomLabels", labelKey: "roomLabelsTitle" },
      { type: "presentationStyle", labelKey: "presentationStyleTitle" },
      { type: "textarea", labelKey: "extraNote", placeholderKey: "plancolorNote" },
    ],
  },
};

// ── Frontend Tool Display Name Mapping ───────────────────────
// Maps backend tool IDs to user-facing Turkish display names.
// This is a UI-only mapping — backend tool IDs stay unchanged.

export const TOOL_DISPLAY_NAMES: Record<string, { label: string; description: string }> = {
  // Backend tools (Turkish display names)
  analysis: {
    label: "Tasarım Analizi",
    description: "Malzeme, ışık, kompozisyon ve sunum kalitesini analiz eder.",
  },
  img2img: {
    label: "Premium Render",
    description: "Sketchup görüntünüzü premium mimari render'a dönüştürür.",
  },
  enhance: {
    label: "Referans Stil Render",
    description: "Referans görselin stil, malzeme ve atmosferini uygular.",
  },
  sceneedit: {
    label: "Revizyon Düzenleyici",
    description: "Müşteri notlarını görsele kontrollü revizyon olarak uygular.",
  },
  plancolor: {
    label: "Premium Kat Planı",
    description: "Kat planınızı sunuma hazır, premium görünüme taşır.",
  },
  // Virtual tools (frontend-only tools that reuse backend tool IDs)
  "multi-angle": {
    label: "Çok Açılı Render Lite",
    description: "Aynı mekanın farklı açısını benzer stil ve malzeme diliyle üretir.",
  },
};

// ── Coming Soon Display Names ────────────────────────────────

export const COMING_SOON_DISPLAY_NAMES: Record<string, string> = {
  presentation: "Sunum Paftası",
  climate: "İklim & Güneş Analizi",
  exploded: "Patlatılmış Diyagram",
  concept: "Konsept Süreç Paftası",
};

// ── Styles (Redesigned — No Emoji) ───────────────────────────

export const STYLES: StyleOption[] = [
  {
    id: "modern",
    label: "Modern Minimal",
    iconName: "Building2",
    swatch: "#c6a87c",
    accentColor: "text-amber-300",
    accentBg: "bg-amber-400/10",
    accentBorder: "border-amber-400/20",
  },
  {
    id: "luxury",
    label: "Warm Luxury",
    iconName: "Sparkles",
    swatch: "#d4a574",
    accentColor: "text-orange-300",
    accentBg: "bg-orange-400/10",
    accentBorder: "border-orange-400/20",
  },
  {
    id: "scandinavian",
    label: "Scandinavian Calm",
    iconName: "Sun",
    swatch: "#a3b1c6",
    accentColor: "text-blue-300",
    accentBg: "bg-blue-400/10",
    accentBorder: "border-blue-400/20",
  },
  {
    id: "brutalist",
    label: "Brutalist Soft",
    iconName: "Building2",
    swatch: "#8a8a8a",
    accentColor: "text-gray-300",
    accentBg: "bg-gray-400/10",
    accentBorder: "border-gray-400/20",
  },
  {
    id: "mediterranean",
    label: "Mediterranean",
    iconName: "Sun",
    swatch: "#e8c48a",
    accentColor: "text-yellow-300",
    accentBg: "bg-yellow-400/10",
    accentBorder: "border-yellow-400/20",
  },
  {
    id: "japandi",
    label: "Japandi",
    iconName: "Layers",
    swatch: "#b8a99a",
    accentColor: "text-stone-300",
    accentBg: "bg-stone-400/10",
    accentBorder: "border-stone-400/20",
  },
  {
    id: "natural-stone",
    label: "Natural Stone",
    iconName: "Layers",
    swatch: "#9e9489",
    accentColor: "text-neutral-300",
    accentBg: "bg-neutral-400/10",
    accentBorder: "border-neutral-400/20",
  },
  {
    id: "contemporary",
    label: "Contemporary Villa",
    iconName: "Building2",
    swatch: "#b0a89c",
    accentColor: "text-warmGray-300",
    accentBg: "bg-warmGray-400/10",
    accentBorder: "border-warmGray-400/20",
  },
];

// ── Atmosphere Options (Premium Render) ──────────────────────

export const ATMOSPHERE_OPTIONS = [
  { id: "golden-hour", labelKey: "atmosphereGoldenHour" },
  { id: "natural-daylight", labelKey: "atmosphereNaturalDaylight" },
  { id: "twilight", labelKey: "atmosphereTwilight" },
  { id: "overcast-soft", labelKey: "atmosphereOvercastSoft" },
  { id: "warm-interior", labelKey: "atmosphereWarmInterior" },
  { id: "cool-modern", labelKey: "atmosphereCoolModern" },
  { id: "dramatic-shadow", labelKey: "atmosphereDramaticShadow" },
  { id: "sunny-morning", labelKey: "atmosphereSunnyMorning" },
];

// ── Material Language Options (Premium Render) ────────────────

export const MATERIAL_OPTIONS = [
  { id: "natural-wood", labelKey: "materialNaturalWood" },
  { id: "stone-marble", labelKey: "materialStoneMarble" },
  { id: "metal-glass", labelKey: "materialMetalGlass" },
  { id: "concrete-minimal", labelKey: "materialConcreteMinimal" },
  { id: "warm-textile", labelKey: "materialWarmTextile" },
  { id: "mixed-premium", labelKey: "materialMixedPremium" },
];

// ── Style Strength Options (Referans Stil Render) ─────────────

export const STYLE_STRENGTH_OPTIONS = [
  { id: "low", labelKey: "strengthLow" },
  { id: "medium", labelKey: "strengthMedium" },
  { id: "high", labelKey: "strengthHigh" },
];

// ── Preserved Elements (Referans Stil Render) ─────────────────

export const PRESERVED_ELEMENTS = [
  { id: "perspective", labelKey: "preservePerspective" },
  { id: "massing", labelKey: "preserveMassing" },
  { id: "window-position", labelKey: "preserveWindowPosition" },
  { id: "furniture-layout", labelKey: "preserveFurnitureLayout" },
  { id: "floor-separation", labelKey: "preserveFloorSeparation" },
  { id: "ceiling-form", labelKey: "preserveCeilingForm" },
];

// ── Preserved Areas (Revizyon Düzenleyici) ────────────────────

export const PRESERVED_AREAS = [
  { id: "perspective", labelKey: "preservePerspective" },
  { id: "massing", labelKey: "preserveMassing" },
  { id: "furniture-layout", labelKey: "preserveFurnitureLayout" },
  { id: "floor-separation", labelKey: "preserveFloorSeparation" },
];

// ── Plan Type Options (Premium Kat Planı) ─────────────────────

export const PLAN_TYPE_OPTIONS = [
  { id: "floor-plan", labelKey: "planTypeFloor" },
  { id: "site-plan", labelKey: "planTypeSite" },
  { id: "section", labelKey: "planTypeSection" },
  { id: "elevation", labelKey: "planTypeElevation" },
];

// ── Palette Options (Premium Kat Planı) ───────────────────────

export const PALETTE_OPTIONS = [
  { id: "warm-premium", labelKey: "paletteWarmPremium", hex: "#c6a87c" },
  { id: "monochrome", labelKey: "paletteMonochrome", hex: "#8a8a8a" },
  { id: "pastel-architecture", labelKey: "palettePastel", hex: "#a3b1c6" },
  { id: "luxury-real-estate", labelKey: "paletteLuxury", hex: "#d4a574" },
];

// ── Presentation Style Options (Premium Kat Planı) ────────────

export const PRESENTATION_STYLE_OPTIONS = [
  { id: "clean-modern", labelKey: "presentationClean" },
  { id: "architectural-board", labelKey: "presentationBoard" },
  { id: "real-estate", labelKey: "presentationRealEstate" },
  { id: "minimal-line", labelKey: "presentationMinimal" },
];

// ── Report Tone Options (Tasarım Analizi) ─────────────────────

export const REPORT_TONE_OPTIONS = [
  { id: "professional", labelKey: "toneProfessional" },
  { id: "critical", labelKey: "toneCritical" },
  { id: "constructive", labelKey: "toneConstructive" },
  { id: "detailed", labelKey: "toneDetailed" },
];

// ── Scene Edit Modes ─────────────────────────────────────────

export const SCENE_EDIT_MODES = [
  { id: "place", labelKey: "scenePlace" },
  { id: "replace", labelKey: "sceneReplace" },
  { id: "material-swap", labelKey: "sceneMaterialSwap" },
  { id: "scene-compose", labelKey: "sceneCompose" },
  { id: "remove", labelKey: "sceneRemove" },
];

// ── Revizyon Düzenleyici Edit Modes ──────────────────────────

export const REVISION_TYPES = [
  { id: "ceiling", labelKey: "revisionCeiling" },
  { id: "lighting", labelKey: "revisionLighting" },
  { id: "material", labelKey: "revisionMaterial" },
  { id: "furniture", labelKey: "revisionFurniture" },
  { id: "floor", labelKey: "revisionFloor" },
  { id: "general", labelKey: "revisionGeneral" },
];

// ── Processing Steps ─────────────────────────────────────────

export const PROCESSING_STEPS = [
  { id: "prepare", labelKey: "stepPrepare" },
  { id: "prompt", labelKey: "stepPrompt" },
  { id: "generate", labelKey: "stepGenerate" },
  { id: "process", labelKey: "stepProcess" },
  { id: "preview", labelKey: "stepPreview" },
];

// ── Constants ────────────────────────────────────────────────

export const MAX_PROMPT_HISTORY = 8;
export const VARIATION_NOTE_SUFFIX = "Mevcut kompozisyonu ve perspektifi koruyarak farkli bir varyasyon uret. Ana geometriyi bozma.";
export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const ACTIVE_AI_JOB_STORAGE_PREFIX = "archilya:ai-studio:active-job:v1";

// ── Icon Resolver ────────────────────────────────────────────

const LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Sparkles,
  Sun,
  Layers,
  Palette,
  Camera,
  ScanLine,
  Image,
  Wand2,
  FileEdit,
  SplitSquareHorizontal,
  LayoutDashboard,
};

export function resolveStyleIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return LUCIDE_ICONS[iconName] || Layers;
}
