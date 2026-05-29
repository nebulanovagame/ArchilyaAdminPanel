# ARCHILYA AI STUDIO — PROMPT ENGINE V3
## Backend Prompt Orchestration Rebuild — Architecture Document

**Status**: Planning Phase — Audit Complete  
**Author**: Sisyphus — Senior Prompt Systems Architect  
**Date**: 2026-05-29  

---

## A. EXECUTIVE SUMMARY

### Current State (MVP → V3)

The Archilya AI Studio prompt engine currently operates at **MVP-level string concatenation**: all tool settings, user notes, and style directives are smashed into a single `extraNote` flat-text field and sent to the backend as Turkish natural language. There is no prompt contract, no reference analysis, no surgical editing, no provider awareness, and no observability.

### Why This Matters

Users observe:
- **Architectural geometry drift** — camera angle, wall positions, room proportions shift during processing
- **Reference image contamination** — reference images override geometry instead of transferring style/material only
- **Overly aggressive revisions** — "just change the ceiling" rewrites the entire scene
- **Weak preservation** — "preserved areas" have little binding force
- **Multi-angle inconsistency** — different camera angles of the same space look like different designs
- **Black-box debugging** — no visibility into what prompt was actually constructed

### V3 Target Architecture

A **multi-layer prompt orchestration system** with:

| Layer | Purpose |
|-------|---------|
| **Prompt Contract** | Structured constraint document (not flat text) |
| **Reference Analyzer** | Semantic extraction from reference images |
| **Prompt Compiler** | Contract → final prompt with sections, priority, templating |
| **Tool DSLs** | Per-tool domain-specific constraint language |
| **Provider Adapters** | Gemini/Flux/OpenAI-aware formatting |
| **Settings Normalizer** | UI values → structured directives |
| **Observability Layer** | Versioned, debuggable prompt history |

### Success Metrics

- Geometry preservation ≥ 95% on sceneedit/enhance flows
- Reference contamination ≤ 5% (style transfer only)
- SceneEdit surgical precision: non-targeted zones unchanged ≥ 90%
- Multi-angle design DNA consistency ≥ 85%
- Debug capability: any job's full prompt chain inspectable

---

## B. OLD PIPELINE (FULL AUDIT)

### B.1 Pipeline Flow Diagram (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

  UI Layer                     State Layer              Service Layer
  ────────                     ───────────              ─────────────
                                                          
  Tool Rail              useAiStudioSettings            nano-banana-service
  Settings Panel  ────▶  (style, atmosphere,     ────▶  queueAiStudioJob()
  Field Renderer          material, etc.)                │
  Style Picker                                           ├─ primary image → base64
  ReferenceUploader     useAiStudioFileInput             ├─ ref images → base64  
  Canvas                  (refImageFile,                 ├─ route: /flux-job OR /jobs
                           sceneReferences)              └─ payload → API
                                                          
                         useAiStudioToolSelection     API Routes
                           (tool, sceneEditMode)      ──────────
                                                      /api/ai-studio/jobs
                         useAiStudioJobLifecycle      /api/ai-studio/flux-job
                           handleGenerate()               │
                              │                           ├─ validate (Zod)
                              ▼                           └─ callBackendCallable:
                    buildToolNote()                          createAiStudioJobSecure
                    (utils.ts)                               runAiStudioFluxTool
                         │
              ┌──────────┼──────────┐                     ┌──────────────┐
              │          │          │                     │  WebBackend  │
         img2img    enhance    sceneedit                  │  (BLACK BOX) │
              │          │          │                     │              │
              ▼          ▼          ▼                     │  Gemini API  │
        "Atmosfer:    "Stil gücü:  "Revizyon:            │  Flux API    │
         Golden Hour.  Düşük.      tavan.                 │  Replicate   │
         Malzeme dili: Korunacak:  Korunacak:             └──────────────┘
         Doğal Ahşap." perspektif." perspektif."

                    ALL OUTPUT: SINGLE FLAT TEXT STRING
                          → sent as `extraNote`
```

### B.2 Complete File Map

```
PROMPT PIPELINE FILES (all paths relative to src/)

FRONTEND — UI Components
  app/(dashboard)/ai-studio/components/
    ai-studio-tool-rail.tsx             — Left tool selection bar
    ai-studio-settings-panel.tsx        — Right settings panel
    ai-studio-field-renderer.tsx        — Dynamic field renderer (atmosphere/material/etc.)
    ai-studio-style-picker.tsx          — Style card grid
    reference-uploader.tsx              — Primary image drag-drop
    ai-studio-canvas.tsx                — Center workspace orchestrator
    ai-studio-generate-bar.tsx          — Generate/variation buttons
    ai-studio-mobile-settings.tsx       — Mobile bottom sheet settings

FRONTEND — Constants & Types
  app/(dashboard)/ai-studio/
    constants.ts                        — TOOLS, TOOL_SETTINGS, STYLES, ATMOSPHERE_OPTIONS,
                                          MATERIAL_OPTIONS, STYLE_STRENGTH_OPTIONS, PLAN_TYPE_OPTIONS,
                                          PALETTE_OPTIONS, PRESENTATION_STYLE_OPTIONS, REPORT_TONE_OPTIONS,
                                          SCENE_EDIT_MODES, REVISION_TYPES, PRESERVED_ELEMENTS,
                                          PRESERVED_AREAS, VARIATION_NOTE_SUFFIX
    types.ts                            — ToolConfig, StyleOption, SceneReference, SettingsField,
                                          StoredActiveJob, GenerateContext, ProcessingStep

FRONTEND — State Hooks (highest coupling area)
  app/(dashboard)/ai-studio/hooks/
    use-ai-studio-state.ts              — ⚠️ Orchestrator facade (645 lines), composes 4 sub-hooks
    use-ai-studio-settings.tsx          — Per-tool settings state (style, atmosphere, material, etc.)
    use-ai-studio-file-input.ts         — File/image state (primary image, scene references)
    use-ai-studio-tool-selection.ts     — Tool switching, sceneEditMode
    use-ai-studio-job-lifecycle.ts      — ⚠️ Job submission + terminal handling (640 lines)
    use-ai-studio-job-terminal.ts       — Job completion observer
    use-ai-studio-result.ts             — Result display, revisions, file ops
    use-ai-studio-file-ops.ts           — File save/download/share operations

FRONTEND — Utility / Derived
  app/(dashboard)/ai-studio/
    utils.ts                            — ⚠️ buildToolNote() + sub-builders (468 lines)
    lib/derive-state.ts                 — Pure state derivation (93 lines)
    lib/animation-variants.ts           — Framer Motion presets

SHARED LIB
  lib/ai-studio/
    tools.ts                            — Tool credit costs, AiStudioToolId type (18 lines)
    job-contract.ts                     — ⚠️ Supabase document mapping, AiStudioJobDocument (262 lines)
    job-contract.test.ts                — Contract mapping tests
    service.ts                          — saveAiJobFeedback() (36 lines)

CLIENT SERVICES
  services/
    nano-banana-service.ts              — ⚠️ Image prep, base64 optimization, API calls (740 lines)
    entitlement-service.ts              — Prompt history storage, credits

API ROUTES
  app/api/ai-studio/
    jobs/route.ts                       — POST handler → createAiStudioJobSecure (65 lines)
    flux-job/route.ts                   — POST handler → runAiStudioFluxTool (50 lines)
    feedback/route.ts                   — POST handler → saveJobFeedback
    prompt-history/route.ts             — GET/POST → getAiPromptHistorySecure / saveAiPromptHistorySecure

VALIDATION
  lib/api/validation.ts                 — aiStudioJobBodySchema (Zod), validateRequestBody

HOOKS (global)
  hooks/
    use-ai-studio-job.ts                — Realtime job document observer (wraps useRealtimeDoc)

i18n
  messages/tr.json                      — Turkish labels (lines ~295-745 for aiStudio section)
  messages/en.json                      — English labels
```

### B.3 Data Flow: Settings → Prompt (Detailed)

```
1. USER SELECTS in UI:
   Atmosphere: "Altın Saat" (golden-hour)
   Material: "Doğal Ahşap" (natural-wood)
   Style: "Modern Minimal" (modern)

2. STATE STORES (English IDs):
   settings.atmosphere = "golden-hour"
   settings.materialLanguage = "natural-wood"
   settings.style = "modern"

3. PROMPT CONSTRUCTION (buildToolNote → buildImg2imgNote):
   atmKeys["golden-hour"] → "atmosphereGoldenHour"
   t("dashboard.aiStudio.atmosphereGoldenHour") → "Golden Hour"
   matKeys["natural-wood"] → "materialNaturalWood"
   t("dashboard.aiStudio.materialNaturalWood") → "Doğal Ahşap"

4. FLAT TEXT OUTPUT:
   "Atmosfer: Golden Hour. Malzeme dili: Doğal Ahşap."
   → This is appended to extraNote

5. API PAYLOAD (sent to backend):
   {
     toolId: "img2img",
     style: "modern",                    ← English keyword, separate field
     extraNote: "Atmosfer: Golden Hour. Malzeme dili: Doğal Ahşap.",  ← FLAT TURKISH TEXT
     imagePart: { inlineData: { data: "base64...", mimeType: "image/webp" } },
     referenceImages: [],
     generationVariant: "default"
   }

6. BACKEND (BLACK BOX — WebBackend callable):
   - Receives style="modern" + extraNote="Atmosfer: Golden Hour..."
   - Constructs Gemini/Flux prompt internally
   - NO structured contract — backend must parse Turkish NL
```

### B.4 Identified Problems (Root Cause Analysis)

| Symptom | Root Cause | File(s) |
|---------|-----------|---------|
| **Geometry drift** | No structured preservation contract; "Korunacak alanlar" is just Turkish text appended to extraNote | `utils.ts:buildEnhanceNote` (L265-285), `utils.ts:buildSceneEditNote` (L287-307) |
| **Reference contamination** | References sent as raw base64 with simple type labels (object/material/style); no semantic analysis or transfer scoping | `nano-banana-service.ts:queueAiStudioJob` (L530-549) |
| **Aggressive scene editing** | Revision type is just "Revizyon alanı: tavan" in Turkish text — model interprets as NL suggestion, not constraint | `utils.ts:buildSceneEditNote` (L287-307) |
| **Weak preservation** | Preservation is flat text appended to extraNote — no priority, no binding force, no negation | `utils.ts:buildEnhanceNote` (L276-284) |
| **Multi-angle inconsistency** | Multi-angle is img2img with different settings panel — no design DNA extraction or style continuity enforcement | `use-ai-studio-job-lifecycle.ts` (L461), `utils.ts:buildMultiAngleNote` (L309-319) |
| **Flat concatenation** | All tool settings merged into single extraNote string — no sections, no hierarchy, no structured directive language | `utils.ts:buildToolNote` (L350-390) |
| **Settings as text, not directives** | "Altın Saat" is translated to "Golden Hour" and embedded in text — should be a structured lighting directive | `utils.ts:buildImg2imgNote` (L247-263) |
| **No provider abstraction** | Same payload format regardless of Gemini/Flux/Replicate — providers need different prompt structures | API routes (jobs, flux-job) send identical payloads |
| **No prompt debugging** | Only `extraNote` is stored — no version, no compiler output, no contract snapshot | `job-contract.ts` — no prompt-related fields |

### B.5 Tool-Specific Pipeline Analysis

#### img2img (Premium Render)
```
Settings: style, atmosphere, materialLanguage
Prompt injection: buildImg2imgNote() → "Atmosfer: {label}. Malzeme dili: {label}."
Style as: separate `style` field ("modern", "luxury", etc.)
Route: /api/ai-studio/flux-job → runAiStudioFluxTool
```

#### enhance (Referans Stil Render)
```
Settings: styleStrength, enhancePreserve[]
Prompt injection: buildEnhanceNote() → "Stil gücü: {label}. Korunacak öğeler: {list}."
Style: N/A (hasStyle: false)
Route: /api/ai-studio/flux-job → runAiStudioFluxTool
```

#### sceneedit (Revizyon Düzenleyici)
```
Settings: sceneEditMode, revisionType, scenePreserveAreas[], sceneReferences[]
Prompt injection: buildSceneEditNote() → "Revizyon alanı: {label}. Korunacak alanlar: {list}."
References: sent as array of {type, label, note, imagePart}
Route: /api/ai-studio/flux-job → runAiStudioFluxTool
```

#### multi-angle (Çok Açılı Render Lite)
```
Settings: multiAnglePreserve[]
Prompt injection: buildMultiAngleNote() → "Korunacak stil öğeleri: {list}."
Backend mapping: toolId "img2img" (virtual tool)
Route: /api/ai-studio/flux-job → runAiStudioFluxTool
```

#### analysis (Tasarım Analizi)
```
Settings: analysisFocus[], reportTone
Prompt injection: buildAnalysisNote() → "Analiz odakları: {list}. Rapor tonu: {label}."
Route: /api/ai-studio/jobs → createAiStudioJobSecure
```

#### plancolor (Premium Kat Planı)
```
Settings: planType, palette, presentationStyle, roomLabels
Prompt injection: buildPlancolorNote() → "Plan türü: {label}. Renk paleti: {label}. Sunum stili: {label}. Oda etiketleri: {göster/gizle}."
Route: /api/ai-studio/jobs → createAiStudioJobSecure
```

---

## C. NEW V3 PIPELINE ARCHITECTURE

### C.1 V3 Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROMPT ENGINE V3 PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────┘

  INPUT LAYER                  PROCESSING LAYER                OUTPUT LAYER
  ───────────                  ────────────────                ───────────

  User Settings          Settings Normalizer               Provider Adapters
  (UI values)      ────▶  (Turkish→structured)       ┌───▶  Gemini Adapter
                         │                           ├───▶  Flux Adapter
  Reference Images       Reference Analyzer          ├───▶  OpenAI Adapter
  (base64/Files)   ────▶  (classification,           └───▶  Replicate Adapter
                          semantic extraction)                    │
                         │                                        ▼
  Tool Selection         Tool DSL Builder              FINAL PROMPT
  (toolId)         ────▶  (per-tool constraint        (provider-formatted,
                          language)                    structured, versioned)
                         │
                         ▼
                    Prompt Contract
                    (structured constraint document)
                         │
                         ▼
                    Prompt Compiler
                    (contract → prompt sections)
                         │
                         ▼
                    Observability Logger
                    (contract snapshot, compiler version,
                     provider adapter, prompt preview)
```

### C.2 New File Architecture

```
src/lib/prompt-engine/                    ← NEW: Prompt Engine V3
  ├── index.ts                            ← Barrel export, feature flag check
  ├── types.ts                            ← Core V3 types
  │
  ├── contract/                           ← Prompt Contract Layer
  │   ├── types.ts                        ← PromptContract, ContractSection, LockedElement
  │   ├── builder.ts                      ← ContractBuilder — assembles contracts
  │   ├── architectural-contract.ts       ← ArchitecturalPreservationContract defaults
  │   └── contract.test.ts
  │
  ├── compiler/                           ← Prompt Compiler Layer
  │   ├── types.ts                        ← CompilerConfig, CompiledSection
  │   ├── compiler.ts                     ← Main compiler: contract → prompt sections
  │   ├── section-builders/               ← Per-section compilers
  │   │   ├── task-section.ts             ← Task type + primary goal
  │   │   ├── preservation-section.ts     ← Mandatory preservation rules
  │   │   ├── forbidden-section.ts        ← Forbidden actions list
  │   │   ├── style-section.ts            ← Style/material/lighting directives
  │   │   ├── reference-section.ts        ← Reference images with scoping
  │   │   └── analysis-section.ts         ← Analysis directives
  │   └── compiler.test.ts
  │
  ├── reference-analyzer/                 ← Reference Analyzer Layer
  │   ├── types.ts                        ← ReferenceAnalysis, ReferenceBrief
  │   ├── analyzer.ts                     ← Main analyzer: image → semantics
  │   ├── classifiers.ts                  ← Reference type classification
  │   ├── weighting.ts                    ← Multi-reference weighting system
  │   └── analyzer.test.ts
  │
  ├── settings-normalizer/                ← Settings Normalizer Layer
  │   ├── types.ts                        ← NormalizedSetting, Directive
  │   ├── normalizer.ts                   ← UI values → structured directives
  │   ├── mappings.ts                     ← Setting ID → directive mapping tables
  │   └── normalizer.test.ts
  │
  ├── dsl/                                ← Tool DSL Layer
  │   ├── types.ts                        ← ToolDSL, Constraint, Zone
  │   ├── sceneedit-dsl.ts                ← SceneEdit DSL: EDIT_TARGET, LOCKED_ZONES
  │   ├── enhance-dsl.ts                  ← Enhance DSL: STYLE_TRANSFER, PRESERVE_CONTRACT
  │   ├── analysis-dsl.ts                 ← Analysis DSL: OBSERVATION, CRITIQUE, IMPROVEMENT
  │   ├── plancolor-dsl.ts                ← Plan DSL: GRAPHIC_STYLE, READABILITY_RULES
  │   ├── img2img-dsl.ts                  ← img2img DSL: RENDER_MODE, ATMOSPHERE, MATERIAL
  │   ├── multiangle-dsl.ts               ← Multi-angle DSL: STYLE_CONTINUITY, CAMERA_VARIATION
  │   └── dsl.test.ts
  │
  ├── providers/                          ← Provider Adapter Layer
  │   ├── types.ts                        ← ProviderAdapter, ProviderPrompt
  │   ├── gemini-adapter.ts               ← Gemini-specific formatting
  │   ├── flux-adapter.ts                 ← Flux-specific formatting
  │   ├── openai-adapter.ts               ← OpenAI-specific formatting
  │   └── adapter-registry.ts             ← Provider → adapter mapping
  │
  ├── observability/                      ← Debug / Observability Layer
  │   ├── types.ts                        ← PromptLog, ContractSnapshot
  │   ├── logger.ts                       ← Per-job prompt logging
  │   └── logger.test.ts
  │
  └── feature-flag.ts                     ← PROMPT_ENGINE_V3_ENABLED flag

src/app/(dashboard)/ai-studio/
  ├── utils.ts                            ← MODIFIED: add V3 path alongside legacy
  ├── hooks/use-ai-studio-job-lifecycle.ts ← MODIFIED: call V3 engine when flag enabled
  └── constants.ts                        ← MODIFIED: add V3 setting mappings

src/lib/api/
  └── validation.ts                       ← MODIFIED: add PromptContract to job schema

src/lib/ai-studio/
  └── job-contract.ts                     ← MODIFIED: add promptVersion, contractSnapshot fields
```

---

## D. PROMPT CONTRACT DESIGN

### D.1 PromptContract Type

```typescript
// src/lib/prompt-engine/contract/types.ts

export interface PromptContract {
  /** Semantic version of the contract schema */
  version: "3.0.0";
  
  /** Which tool this contract was built for */
  toolId: AiStudioToolId;
  
  /** Primary task type and goal */
  task: TaskDirective;
  
  /** Architectural preservation rules */
  architecturalPreservation: ArchitecturalPreservationContract;
  
  /** Style, material, and lighting instructions */
  styleDirectives: StyleDirectives;
  
  /** Reference image policies */
  referencePolicy: ReferencePolicy;
  
  /** Tool-specific constraint block (DSL output) */
  toolConstraints: ToolConstraintBlock;
  
  /** Analysis directives (analysis tool only) */
  analysisDirectives?: AnalysisDirectives;
  
  /** Generation variant */
  variant: "default" | "variation" | "retry";
  
  /** User-provided notes (raw, preserved) */
  userNote?: string;
}

export interface TaskDirective {
  type: "architectural-render" | "style-transfer" | "scene-edit" | "multi-angle" | "analysis" | "plan-color";
  primaryGoal: string;
  architecturalMode: "preserve" | "enhance" | "edit" | "analyze";
  editScope?: "full" | "surgical";
}

export interface ArchitecturalPreservationContract {
  /** Elements that MUST be preserved exactly */
  mandatory: PreservationRule[];
  
  /** Elements that should be preserved unless explicitly overridden */
  preferred: PreservationRule[];
  
  /** Explicitly forbidden actions */
  forbidden: ForbiddenAction[];
  
  /** Zones that are locked from any changes */
  lockedZones: LockedZone[];
  
  /** Zones where changes are explicitly allowed */
  editableZones: EditableZone[];
}

export interface PreservationRule {
  element: "camera-transform" | "architectural-topology" | "window-coordinates" 
          | "wall-graph" | "room-boundaries" | "massing" | "ceiling-height"
          | "opening-placement" | "furniture-layout" | "floor-separation"
          | "perspective" | "composition";
  priority: "critical" | "high" | "medium";
  description: string;
}

export interface ForbiddenAction {
  action: "redesign-architecture" | "reinterpret-layout" | "hallucinate-openings"
         | "alter-room-proportions" | "change-geometry" | "add-windows"
         | "remove-structural-elements" | "change-camera-angle";
  scope: "global";
  severity: "blocking";
}

export interface LockedZone {
  name: string;           // e.g. "walls", "ceiling", "floor", "windows", "camera"
  reason: string;
}

export interface EditableZone {
  name: string;           // e.g. "ceiling-material", "lighting-fixtures"
  allowedChanges: string[];
  maxChangeIntensity: "subtle" | "moderate" | "significant";
}

export interface StyleDirectives {
  architecturalStyle?: string;
  atmosphere?: AtmosphereDirective;
  materialLanguage?: MaterialDirective;
  lightingStyle?: LightingDirective;
  styleStrength?: number;  // 0.0–1.0
  colorPalette?: string[];
}

export interface AtmosphereDirective {
  timeOfDay: "golden-hour" | "midday" | "twilight" | "overcast" | "morning" | "night";
  lightQuality: "warm" | "cool" | "neutral" | "dramatic";
  interiorExterior: "interior" | "exterior" | "unspecified";
  shadowIntensity: "soft" | "medium" | "hard";
}

export interface MaterialDirective {
  primaryMaterialFamily: "wood" | "stone" | "metal" | "glass" | "concrete" | "textile" | "mixed";
  tone: "warm" | "cool" | "neutral";
  finish: "matte" | "satin" | "glossy" | "natural";
  quality: "premium" | "standard";
}

export interface LightingDirective {
  type: "natural" | "artificial" | "mixed";
  warmth: "warm" | "neutral" | "cool";
  intensity: "bright" | "moderate" | "dim" | "dramatic";
  source: "sunlight" | "ambient" | "task" | "accent" | "recessed" | "pendant";
}

export interface ReferencePolicy {
  references: ReferenceBrief[];
  defaultBehavior: "style-and-material-only";  // NEVER geometry
}

export interface ReferenceBrief {
  id: string;
  type: "style" | "material" | "object" | "lighting" | "layout" | "scene";
  weight: number;  // 0.0–1.0
  geometryRisk: "low" | "medium" | "high";
  allowedTransfer: string[];
  forbiddenTransfer: string[];
  styleSummary?: string;
  materialSummary?: string;
  lightingSummary?: string;
  objectSummary?: string;
}

export interface ToolConstraintBlock {
  toolId: string;
  dslVersion: string;
  constraints: Record<string, unknown>;  // Tool-specific DSL output
}
```

### D.2 Example Contract (sceneedit — ceiling only)

```json
{
  "version": "3.0.0",
  "toolId": "sceneedit",
  "task": {
    "type": "scene-edit",
    "primaryGoal": "Change only the ceiling material and lighting fixtures. Preserve everything else.",
    "architecturalMode": "edit",
    "editScope": "surgical"
  },
  "architecturalPreservation": {
    "mandatory": [
      { "element": "camera-transform", "priority": "critical", "description": "Exact camera angle, position, and FOV" },
      { "element": "architectural-topology", "priority": "critical", "description": "Wall positions, room boundaries, structural elements" },
      { "element": "window-coordinates", "priority": "high", "description": "All window positions and sizes" },
      { "element": "furniture-layout", "priority": "high", "description": "Furniture positions and orientations" },
      { "element": "floor-separation", "priority": "high", "description": "Floor-to-floor heights and floor materials" },
      { "element": "massing", "priority": "critical", "description": "Building mass, volume, overall form" }
    ],
    "forbidden": [
      { "action": "redesign-architecture", "scope": "global", "severity": "blocking" },
      { "action": "change-camera-angle", "scope": "global", "severity": "blocking" },
      { "action": "alter-room-proportions", "scope": "global", "severity": "blocking" },
      { "action": "hallucinate-openings", "scope": "global", "severity": "blocking" }
    ],
    "lockedZones": [
      { "name": "walls", "reason": "Client requested no wall changes" },
      { "name": "windows", "reason": "Client requested no window changes" },
      { "name": "camera", "reason": "Camera must remain identical for before/after comparison" },
      { "name": "floor", "reason": "Client requested no floor changes" },
      { "name": "furniture", "reason": "Furniture layout must remain unchanged" }
    ],
    "editableZones": [
      { "name": "ceiling", "allowedChanges": ["material", "lighting-fixtures", "color"], "maxChangeIntensity": "moderate" }
    ]
  },
  "styleDirectives": {
    "materialLanguage": { "primaryMaterialFamily": "wood", "tone": "warm", "finish": "matte", "quality": "premium" }
  },
  "referencePolicy": {
    "references": [
      { "id": "ref-1", "type": "material", "weight": 0.8, "geometryRisk": "low", "allowedTransfer": ["ceiling-wood-tone"], "forbiddenTransfer": ["camera-angle", "wall-geometry", "window-positions"], "materialSummary": "warm walnut wood ceiling finish" }
    ],
    "defaultBehavior": "style-and-material-only"
  },
  "toolConstraints": {
    "toolId": "sceneedit",
    "dslVersion": "1.0.0",
    "constraints": {
      "editTarget": "ceiling",
      "allowedScope": ["ceiling-material", "ceiling-lighting"],
      "forbiddenScope": ["walls", "windows", "camera", "floor", "furniture", "structural"],
      "referencePolicy": "material-transfer-only"
    }
  },
  "variant": "default"
}
```

---

## E. COMPILER DESIGN

### E.1 Compiler Flow

```
PromptContract → Compiler → CompiledPrompt → ProviderAdapter → Final Prompt
```

The compiler transforms the structured contract into sections that can be formatted differently per provider.

### E.2 CompiledPrompt Type

```typescript
interface CompiledPrompt {
  version: string;
  compilerVersion: string;
  sections: CompiledSection[];
  metadata: {
    contractHash: string;
    compiledAt: string;
    toolId: string;
    sectionCount: number;
    totalTokens: number;
  };
}

interface CompiledSection {
  id: string;
  priority: "critical" | "high" | "medium" | "low" | "informational";
  heading: string;
  body: string;           // Provider-agnostic content
  tokens: number;
  order: number;
}
```

### E.3 Compiler Section Builders

| Section ID | Priority | Source | Content |
|-----------|----------|--------|---------|
| `task-definition` | critical | `contract.task` | Primary goal, architectural mode, edit scope |
| `mandatory-preservation` | critical | `contract.architecturalPreservation.mandatory` | MUST PRESERVE list with priority |
| `forbidden-actions` | critical | `contract.architecturalPreservation.forbidden` | FORBIDDEN list with severity |
| `locked-zones` | high | `contract.architecturalPreservation.lockedZones` | Locked zones with reasons |
| `editable-zones` | high | `contract.architecturalPreservation.editableZones` | Allowed changes with intensity |
| `style-directives` | medium | `contract.styleDirectives` | Atmosphere, material, lighting |
| `reference-policy` | medium | `contract.referencePolicy` | What to transfer, what to forbid |
| `tool-constraints` | high | `contract.toolConstraints` | Tool-specific DSL output |
| `analysis-directives` | medium | `contract.analysisDirectives` | Analysis focus and report style |
| `user-note` | low | `contract.userNote` | User's original note text |
| `output-format` | informational | (compiler-generated) | Expected output format |

### E.4 Example Compiler Output (sceneedit, surgical, English)

```
=== TASK DEFINITION ===
You are performing a SURGICAL SCENE EDIT on an architectural interior rendering.
PRIMARY GOAL: Change only the ceiling material and lighting fixtures. Preserve everything else.
ARCHITECTURAL MODE: Edit (surgical scope — only targeted zones may change).

=== MANDATORY PRESERVATION (CRITICAL) ===
These elements MUST remain pixel-exact identical to the input image:
1. [CRITICAL] CAMERA TRANSFORM — exact camera angle, position, FOV
2. [CRITICAL] ARCHITECTURAL TOPOLOGY — wall positions, room boundaries, structural elements
3. [CRITICAL] MASSING — building mass, volume, overall form
4. [HIGH] WINDOW COORDINATES — all window positions and sizes
5. [HIGH] FURNITURE LAYOUT — furniture positions and orientations
6. [HIGH] FLOOR SEPARATION — floor-to-floor heights and floor materials

=== FORBIDDEN ACTIONS (BLOCKING VIOLATIONS) ===
DO NOT under any circumstances:
- Redesign the architecture
- Change the camera angle
- Alter room proportions
- Hallucinate new openings, windows, or doors
- Add or remove structural elements
- Modify walls, floor, furniture, or windows

=== LOCKED ZONES (NO CHANGES) ===
- WALLS → no changes (client requirement)
- WINDOWS → no changes (client requirement)
- CAMERA → no changes (before/after comparison)
- FLOOR → no changes (client requirement)
- FURNITURE → no changes (client requirement)

=== EDITABLE ZONES ===
- CEILING: allowed changes: [material, lighting-fixtures, color]
  Max change intensity: MODERATE

=== STYLE DIRECTIVES ===
- Material Language: warm wood tones, matte finish, premium quality

=== REFERENCE POLICY ===
Reference images are for STYLE AND MATERIAL TRANSFER ONLY.
They are NOT geometry sources. Do NOT copy camera angles, wall positions, or room proportions from references.

Reference #1 (weight: 0.80):
  Type: material reference
  ALLOWED TRANSFER: ceiling wood tone, warm walnut finish
  FORBIDDEN TRANSFER: camera angle, wall geometry, window positions, room proportions

=== TOOL CONSTRAINTS (SceneEdit DSL v1.0.0) ===
- EDIT TARGET: ceiling
- ALLOWED SCOPE: ceiling-material, ceiling-lighting
- FORBIDDEN SCOPE: walls, windows, camera, floor, furniture, structural
- REFERENCE POLICY: material-transfer-only

=== OUTPUT FORMAT ===
Return the modified image with ONLY the specified ceiling changes applied.
All other elements must remain identical to the input.
```

### E.5 Compiler Features

1. **Section ordering by priority** — critical sections first
2. **Repetition of key constraints** — critical rules repeated at multiple sections
3. **Negative constraint density** — "DO NOT" statements ≥ positive statements for surgical edits
4. **Token budgeting** — sections trimmed to fit provider context limits
5. **Provider-agnostic body** — adapter transforms this to provider-specific format

---

## F. REFERENCE ANALYZER ENGINE

### F.1 Analysis Pipeline

```
Reference Image (base64)
       │
       ▼
  ┌─────────────┐
  │ Classifier   │ → referenceType: "style" | "material" | "object" | "lighting" | "layout" | "scene"
  └─────────────┘
       │
       ▼
  ┌─────────────┐
  │ Semantic     │ → styleSummary, materialSummary, lightingSummary, objectSummary
  │ Extractor    │
  └─────────────┘
       │
       ▼
  ┌─────────────┐
  │ Risk         │ → geometryRisk: "low" | "medium" | "high"
  │ Assessor     │
  └─────────────┘
       │
       ▼
  ┌─────────────┐
  │ Reference    │ → {allowedTransfer[], forbiddenTransfer[], weight}
  │ Brief        │
  └─────────────┘
```

### F.2 ReferenceAnalyzer Interface

```typescript
interface ReferenceAnalyzer {
  analyze(image: InlineImagePart, toolId: string, userLabel?: string): Promise<ReferenceBrief>;
}

// On the FRONTEND: lightweight classification based on user input + image metadata
// On the BACKEND: full semantic analysis using vision model
```

### F.3 Reference Brief Output

```typescript
interface ReferenceBrief {
  referenceType: "style" | "material" | "object" | "lighting" | "layout" | "scene";
  geometryRisk: "low" | "medium" | "high";
  
  // Semantic summaries
  styleSummary: string;       // e.g. "minimalist Japanese influence with natural tones"
  materialSummary: string;    // e.g. "warm walnut wood, white limestone, bronze fixtures"
  lightingSummary: string;    // e.g. "warm indirect lighting, golden hour sunlight"
  objectSummary: string;      // e.g. "low-profile furniture, organic shapes"
  
  // Transfer scoping
  allowedTransfer: string[];  // e.g. ["walnut-wood-tone", "bronze-fixture-style"]
  forbiddenTransfer: string[];// e.g. ["camera-angle", "wall-geometry", "room-proportions", "window-positions"]
  
  // Weight
  weight: number;             // 0.0–1.0, default based on referenceType
}
```

### F.4 Default Behavior

**CRITICAL RULE**: Reference images are NEVER geometry sources by default.

```
Default forbiddenTransfer (ALWAYS):
- camera angle, position, FOV
- wall positions, geometry, room boundaries
- window positions, sizes, count
- door positions, sizes, count  
- room proportions, floor heights
- structural elements

Default allowedTransfer (by type):
- style reference → color palette, material language, atmosphere, lighting mood
- material reference → material textures, finishes, tones
- object reference → object shapes, furniture styles, fixture designs
- lighting reference → light temperature, fixture styles, shadow patterns
- layout reference → furniture arrangement patterns (BUT NOT room geometry)
```

---

## G. TOOL DSL DESIGN

### G.1 SceneEdit DSL — Surgical Edit Mode

```
DSL: sceneedit-v1

CONSTRAINTS:
  EDIT_TARGET: <zone>
    Values: ceiling | lighting | material | furniture | floor | general
  
  LOCKED_ZONES: <zone[]>
    Values: walls | windows | camera | floor | furniture | structural | perspective
  
  ALLOWED_SCOPE: <action[]>
    Values: material-change | color-change | lighting-change | fixture-replace 
           | object-add | object-remove | object-replace | texture-change
  
  FORBIDDEN_SCOPE: <action[]>
    Values: geometry-modify | structural-change | camera-move | opening-modify
           | proportion-change | layout-change | massing-change
  
  REFERENCE_POLICY: <policy>
    Values: material-transfer-only | style-transfer-only | object-shape-only | none
  
  CHANGE_INTENSITY: <intensity>
    Values: subtle | moderate | significant
  
  REVISION_TYPE: <type>
    Values: ceiling | lighting | material | furniture | floor | general

DSL→Compiler Mapping:
  LOCKED_ZONES → architecturalPreservation.lockedZones
  FORBIDDEN_SCOPE → architecturalPreservation.forbidden
  ALLOWED_SCOPE → editableZones[].allowedChanges
  REVISION_TYPE → task.editScope = "surgical" + primaryGoal targeting
```

### G.2 Enhance DSL

```
DSL: enhance-v1

CONSTRAINTS:
  STYLE_TRANSFER: <mode>
    Values: subtle | balanced | strong
    → maps to styleStrength (0.3, 0.6, 0.9)
  
  PRESERVE_CONTRACT: <elements[]>
    Values: perspective | massing | window-position | furniture-layout 
           | floor-separation | ceiling-form
    → each becomes a mandatory preservation rule
  
  QUALITY_UPGRADE: <targets[]>
    Values: material-resolution | lighting-realism | texture-detail
           | reflection-quality | shadow-accuracy
  
  FORBIDDEN: geometry | layout | camera | proportions
    → always present, non-configurable
```

### G.3 Analysis DSL

```
DSL: analysis-v1

CONSTRAINTS:
  OBSERVATION_TARGETS: <focus[]>
    Values: material | light | composition | function | presentation | revision
  
  CRITIQUE_MODE: <tone>
    Values: professional | critical | constructive | detailed
    → maps to report structure and language style
  
  IMPROVEMENT_LEVEL: <depth>
    Values: superficial | moderate | deep
  
  REPORT_SECTIONS: [overview, detailed-findings, recommendations, priority-matrix]
```

### G.4 PlanColor DSL

```
DSL: plancolor-v1

CONSTRAINTS:
  GRAPHIC_STYLE: <style>
    Values: clean-modern | architectural-board | real-estate | minimal-line
  
  READABILITY_RULES:
    room-labels: <boolean>
    wall-thickness: <preserve | enhance>
    dimension-lines: <preserve | remove>
  
  COLOR_PALETTE: <palette>
    Values: warm-premium | monochrome | pastel-architecture | luxury-real-estate
  
  ANNOTATION_POLICY:
    room-names: <show | hide>
    area-dimensions: <show | hide>
    north-arrow: <preserve | add | remove>
```

### G.5 Multi-Angle DSL (NEW — replaces img2img hack)

```
DSL: multiangle-v1

CONSTRAINTS:
  STYLE_CONTINUITY: <elements[]>
    Values: wood-tones | metal-finishes | lighting-mood | furniture-style 
           | wall-material | atmosphere
  
  CAMERA_VARIATION: <type>
    Values: opposite-angle | adjacent-angle | birdseye | eye-level-alt
  
  DESIGN_DNA_EXTRACTION:
    - material language (from source image)
    - lighting mood (from source image)
    - furniture vocabulary (from source image)
    - color palette (from source image)
    - presentation style (from source image)
  
  FORBIDDEN:
    - do NOT copy geometry from previous angle
    - do NOT copy camera transform
    - generate NEW camera interpretation
    - maintain SAME design DNA
```

---

## H. PROVIDER ADAPTER LAYER

### H.1 Adapter Interface

```typescript
interface ProviderAdapter {
  provider: "gemini" | "flux" | "openai" | "replicate";
  version: string;
  
  /** Transform compiled sections into provider-specific format */
  format(compiled: CompiledPrompt, options?: ProviderFormatOptions): ProviderPrompt;
  
  /** Get max token budget for this provider/model */
  getMaxTokens(model?: string): number;
  
  /** Check if a feature is supported */
  supports(feature: "multi-image" | "system-prompt" | "negative-prompt" | "image-mask"): boolean;
}

interface ProviderPrompt {
  provider: string;
  model?: string;
  
  /** Provider-specific prompt structure */
  systemPrompt?: string;        // Gemini system instruction
  userPrompt?: string;          // Main prompt text
  negativePrompt?: string;      // Flux negative prompt
  imagePrompt?: InlineImagePart[];  // Image inputs
  parameters?: Record<string, unknown>;  // Provider-specific params (guidance, steps, etc.)
  
  /** Metadata */
  sections: CompiledSection[];
  promptVersion: string;
}
```

### H.2 Gemini Adapter

Gemini excels with structured system instructions + clear constraints.

```typescript
class GeminiAdapter implements ProviderAdapter {
  format(compiled: CompiledPrompt): ProviderPrompt {
    return {
      provider: "gemini",
      model: "gemini-2.5-flash",
      systemPrompt: this.buildSystemPrompt(compiled),  // All constraints
      userPrompt: this.buildUserPrompt(compiled),      // Task + reference info
      imagePrompt: compiled.metadata.images,
      sections: compiled.sections,
      promptVersion: "3.0.0",
    };
  }
  
  // Gemini system prompt: critical constraints first, negative rules emphasized
  private buildSystemPrompt(compiled: CompiledPrompt): string {
    return [
      "You are an ARCHITECTURAL RENDERING SPECIALIST.",
      "",
      ...this.formatCriticalSections(compiled),  // preservation, forbidden, locked zones
      "",
      "IMPORTANT: Violating these constraints will result in REJECTION.",
    ].join("\n");
  }
}
```

### H.3 Flux Adapter

Flux supports negative prompts and benefits from clear positive/negative separation.

```typescript
class FluxAdapter implements ProviderAdapter {
  format(compiled: CompiledPrompt): ProviderPrompt {
    return {
      provider: "flux",
      model: "flux-1.1-pro",
      userPrompt: this.buildPositivePrompt(compiled),   // What TO do
      negativePrompt: this.buildNegativePrompt(compiled), // What NOT to do
      imagePrompt: compiled.metadata.images,
      parameters: {
        guidance_scale: 7.5,
        num_inference_steps: 28,
      },
      sections: compiled.sections,
      promptVersion: "3.0.0",
    };
  }
}
```

---

## I. TOOL IMPROVEMENTS

### I.1 SceneEdit — Surgical Mode (CRITICAL)

**Problem**: Revision type is "Revizyon alanı: tavan" — flat Turkish text with no binding force.

**Solution**: SceneEdit DSL maps revision type to structured constraints:

| Revision Type | EDIT_TARGET | LOCKED_ZONES | ALLOWED_SCOPE |
|--------------|-------------|--------------|---------------|
| ceiling | ceiling | walls, windows, camera, floor, furniture, structural | material, lighting, color |
| lighting | lighting-fixtures | walls, windows, camera, floor, ceiling-material, structural | fixture-style, light-temperature, position |
| material | materials | walls, windows, camera, structural, massing | texture, color, finish |
| furniture | furniture | walls, windows, camera, floor, ceiling, structural | object-replace, object-add, object-remove |
| floor | floor | walls, windows, camera, ceiling, furniture, structural | material, color, pattern |
| general | (none) | perspective, massing (preserve only) | all (with preservation rules) |

**Implementation**: 
- `dsl/sceneedit-dsl.ts` maps `sceneEditMode` + `revisionType` to DSL constraints
- Compiler generates locked/editable zone sections with explicit DO NOT statements
- Negative prompt for Flux explicitly lists forbidden changes

### I.2 Reference Image — Scope + Weight (CRITICAL)

**Problem**: References sent as raw base64 with type labels. No scoping, no weighting.

**Solution**: Reference Analyzer on the backend provides semantic briefs. Frontend passes structured reference policy:

```typescript
// OLD (current):
referenceImages: [{ type: "object", label: "ceiling_ref", note: "wood ceiling", imagePart: {...} }]

// NEW (V3):
referencePolicy: {
  references: [{
    id: "ref-1",
    type: "material",
    weight: 0.8,
    allowedTransfer: ["walnut-wood-tone", "matte-finish"],
    forbiddenTransfer: ["camera-angle", "wall-geometry", "window-positions", "room-proportions"]
  }],
  defaultBehavior: "style-and-material-only"
}
```

### I.3 Multi-Angle — Dedicated Engine (CRITICAL)

**Problem**: Multi-angle is img2img with a different settings panel.

**Solution**: Dedicated `multiangle-dsl.ts` with design DNA extraction:

```
NEW FLOW:
  1. Source Image → Extract Design DNA:
     - Material language (wood tones, stone types, etc.)
     - Lighting mood (warmth, direction, intensity)
     - Furniture vocabulary (style, era, material)
     - Color palette (dominant colors, accents)
     - Presentation style (render quality, atmosphere)
  
  2. Generate Prompt Contract:
     - STYLE CONTINUITY: all extracted elements
     - CAMERA VARIATION: new angle specification
     - FORBIDDEN: geometry copy, camera copy
  
  3. Compiler produces:
     - "Generate a NEW camera angle of the SAME space"
     - "Use these materials: [extracted]"
     - "Use this lighting: [extracted]"
     - "Maintain this furniture style: [extracted]"
     - "DO NOT copy the previous camera position"
```

### I.4 Preservation — Stronger Contract (HIGH)

**Problem**: "Korunacak öğeler" is flat Turkish text.

**Solution**: Structured `ArchitecturalPreservationContract` with:

1. **Priority levels**: critical > high > medium
2. **Mandatory vs. preferred**: critical are blocking, preferred are strong suggestions
3. **FORBIDDEN actions**: explicit negative constraints (works with Flux negative prompts)
4. **LOCKED ZONES**: named zones with reasons (Gemini system instructions)
5. **Repetition**: critical rules repeated in system prompt, user prompt, and section headers

---

## J. QA DATASET

### J.1 Test Scenarios

#### TEST 1: SketchUp Raw Interior → Premium Render (Geometry Preservation)
```
INPUT: Raw SketchUp interior render (low quality, hard lighting, no materials)
TOOL: img2img
STYLE: modern
ATMOSPHERE: golden-hour
MATERIAL: natural-wood
EXPECTED: 
  ✅ Camera angle unchanged
  ✅ Wall positions preserved
  ✅ Window positions preserved
  ✅ Room proportions preserved
  ✅ Materials upgraded (wood visible, warm lighting)
  ✅ Atmospheric lighting applied (golden hour warmth)
FAIL IF:
  ❌ Camera angle shifted > 5 degrees
  ❌ Window moved to different wall
  ❌ Room proportions changed
  ❌ Structural elements added/removed
PASS/FAIL RUBRIC:
  - Architectural Fidelity Score ≥ 95/100
  - Geometry drift ≤ 2%
  - Material upgrade visible: yes
  - Atmosphere applied: yes
```

#### TEST 2: Reference Style Transfer (No Geometry Contamination)
```
INPUT: Modern villa exterior + Mediterranean style reference
TOOL: enhance
STYLE_STRENGTH: medium
PRESERVE: perspective, massing, window-position
EXPECTED:
  ✅ Mediterranean material palette applied (warm stone, terracotta)
  ✅ Camera angle unchanged
  ✅ Window positions unchanged
  ✅ Building mass unchanged
  ✅ Warm lighting applied
FAIL IF:
  ❌ Camera moved (reference's camera angle applied)
  ❌ Window count changed (reference has different windows)
  ❌ Building shape changed to match reference
  ❌ Proportions altered
PASS/FAIL RUBRIC:
  - Reference contamination score ≤ 5%
  - Style transfer visible: yes
  - Geometry preservation: 100%
```

#### TEST 3: SceneEdit — Only Ceiling Change (Surgical Precision)
```
INPUT: Interior render with visible ceiling
TOOL: sceneedit
SCENE_EDIT_MODE: scene-compose
REVISION_TYPE: ceiling
SCENE_PRESERVE_AREAS: perspective, massing, furniture-layout, floor-separation
EXTRA_NOTE: "Tavanı ahşap lambiri yap, spot aydınlatma ekle."
EXPECTED:
  ✅ Ceiling material changed to wood paneling
  ✅ Ceiling lighting changed to spot lights
  ✅ Walls unchanged
  ✅ Floor unchanged
  ✅ Furniture unchanged
  ✅ Camera unchanged
  ✅ Windows unchanged
FAIL IF:
  ❌ Wall color/texture changed
  ❌ Floor material changed
  ❌ Furniture moved/replaced
  ❌ Window changed
  ❌ New structural elements added
PASS/FAIL RUBRIC:
  - Surgical precision score ≥ 90%
  - Non-targeted zone changes ≤ 5%
  - Ceiling change visible: yes
```

#### TEST 4: Furniture Replace (No Layout Drift)
```
INPUT: Interior render with furniture
TOOL: sceneedit
SCENE_EDIT_MODE: replace
REVISION_TYPE: furniture
SCENE_PRESERVE_AREAS: perspective, massing, floor-separation
REFERENCES: furniture style reference image
EXPECTED:
  ✅ Furniture style updated to match reference
  ✅ Furniture positions maintained (same layout)
  ✅ Room boundaries unchanged
  ✅ Camera unchanged
FAIL IF:
  ❌ Furniture moved to different positions
  ❌ Room shape changed
  ❌ New furniture that doesn't exist in original
  ❌ Original furniture removed without replacement
PASS/FAIL RUBRIC:
  - Layout drift ≤ 5%
  - Style update visible: yes
  - Positional accuracy ≥ 90%
```

#### TEST 5: Multi-Angle Continuity (Design DNA)
```
INPUT: Interior render from angle A
TOOL: multi-angle
MULTI_ANGLE_PRESERVE: wood, metal, lighting, furniture, wall, atmosphere
EXPECTED:
  ✅ Different camera angle generated
  ✅ Same wood tones
  ✅ Same metal finishes
  ✅ Same lighting mood
  ✅ Same furniture style
  ✅ Same wall materials
  ✅ Space geometry correct from new angle
FAIL IF:
  ❌ Same camera angle as input
  ❌ Different material palette
  ❌ Different lighting temperature
  ❌ Wrong room shape (geometry doesn't make sense from new angle)
PASS/FAIL RUBRIC:
  - Design DNA consistency ≥ 85%
  - Camera variation: yes (different angle)
  - Material match: yes
```

#### TEST 6: Plan Readability
```
INPUT: Raw architectural floor plan (CAD export)
TOOL: plancolor
PLAN_TYPE: floor-plan
PALETTE: warm-premium
PRESENTATION_STYLE: clean-modern
ROOM_LABELS: true
EXPECTED:
  ✅ Plan geometry preserved
  ✅ Color palette applied
  ✅ Room labels visible
  ✅ Wall thickness preserved
  ✅ Readable presentation
FAIL IF:
  ❌ Wall positions changed
  ❌ Room shapes altered
  ❌ Labels unreadable
  ❌ Colors confused between rooms
PASS/FAIL RUBRIC:
  - Geometry preservation ≥ 95%
  - Color application: correct palette
  - Label readability: yes
```

#### TEST 7: Empty Upload → Error Handling
```
INPUT: No primary image
TOOL: img2img
EXPECTED:
  ✅ Toast error message shown
  ✅ No job created
  ✅ Credit not deducted
```

#### TEST 8: Credit Insufficient → Blocked
```
INPUT: User with 5 credits, trying sceneedit (25 credits)
EXPECTED:
  ✅ Toast error shown
  ✅ Generate button disabled
  ✅ No job created
```

#### TEST 9: V3 vs Legacy Comparison
```
INPUT: Same settings, run through V3 and legacy pipeline
COMPARISON METRICS:
  - Geometry preservation score
  - Reference contamination score
  - Surgical precision score (sceneedit only)
  - Multi-angle consistency score
EXPECTED:
  ✅ V3 scores higher on ALL metrics
  ✅ V3 prompt has structured sections
  ✅ V3 contract is inspectable
```

#### TEST 10: Large File Handling
```
INPUT: 15MB PNG primary image + 4 reference images
EXPECTED:
  ✅ Images optimized below limits
  ✅ No payload rejection
  ✅ Job created successfully
```

---

## K. CHANGED FILES

### New Files (Prompt Engine V3)

```
src/lib/prompt-engine/
  index.ts                              — Barrel export, PROMPT_ENGINE_V3_ENABLED gate
  types.ts                              — Core V3 types (PromptContract, CompiledPrompt, etc.)
  feature-flag.ts                       — Feature flag definition
  contract/builder.ts                   — ContractBuilder
  contract/types.ts                     — Contract types
  contract/architectural-contract.ts    — Default preservation rules
  compiler/compiler.ts                  — Main compiler
  compiler/types.ts                     — Compiler types
  compiler/section-builders/*.ts        — Per-section compilers (6 files)
  reference-analyzer/analyzer.ts        — Reference analysis (frontend-side classification)
  reference-analyzer/types.ts           — Analysis types
  reference-analyzer/classifiers.ts     — Type classification rules
  reference-analyzer/weighting.ts       — Multi-reference weighting
  settings-normalizer/normalizer.ts     — Settings → directive mapper
  settings-normalizer/types.ts          — Normalizer types
  settings-normalizer/mappings.ts       — ID → directive mapping tables
  dsl/types.ts                          — DSL types
  dsl/sceneedit-dsl.ts                  — SceneEdit DSL
  dsl/enhance-dsl.ts                    — Enhance DSL
  dsl/analysis-dsl.ts                   — Analysis DSL
  dsl/plancolor-dsl.ts                  — PlanColor DSL
  dsl/img2img-dsl.ts                    — img2img DSL
  dsl/multiangle-dsl.ts                 — Multi-angle DSL
  providers/types.ts                    — Provider types
  providers/gemini-adapter.ts           — Gemini adapter
  providers/flux-adapter.ts             — Flux adapter
  providers/adapter-registry.ts         — Provider → adapter registry
  observability/logger.ts               — Prompt logging
  observability/types.ts                — Logger types

  # Tests (co-located)
  contract/contract.test.ts
  compiler/compiler.test.ts
  reference-analyzer/analyzer.test.ts
  settings-normalizer/normalizer.test.ts
  dsl/dsl.test.ts
  providers/gemini-adapter.test.ts
  providers/flux-adapter.test.ts
  observability/logger.test.ts

TOTAL NEW FILES: ~30
```

### Modified Files

```
src/lib/ai-studio/job-contract.ts       — Add promptVersion, contractSnapshot, compiledPrompt, providerAdapter fields
src/lib/api/validation.ts               — Extend aiStudioJobBodySchema to optionally accept PromptContract
src/app/(dashboard)/ai-studio/utils.ts  — Add buildToolContract() alongside legacy buildToolNote()
src/app/(dashboard)/ai-studio/hooks/use-ai-studio-job-lifecycle.ts — Feature-gate V3 path
src/app/(dashboard)/ai-studio/constants.ts — Add V3 setting directive mappings
src/app/api/ai-studio/jobs/route.ts     — Accept and forward PromptContract
src/app/api/ai-studio/flux-job/route.ts — Accept and forward PromptContract
src/services/nano-banana-service.ts     — Add V3 queueAiStudioJobV3() alongside legacy

TOTAL MODIFIED FILES: ~8
```

### NOT Changed (Legacy Preserved)

```
- All UI components (tool rail, settings panel, field renderer, etc.) — UNCHANGED
- State hooks (useAiStudioSettings, useAiStudioFileInput, etc.) — UNCHANGED
- i18n messages (tr.json, en.json) — UNCHANGED (V3 uses same labels)
- Legacy buildToolNote() in utils.ts — UNCHANGED (preserved behind feature flag)
```

---

## L. QUALITY RISKS

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Contract too rigid** — models may struggle with dense constraint language | Medium | A/B test constraint density; provide "strict" vs "balanced" contract profiles |
| **Reference analyzer accuracy** — frontend-side classification may mis-categorize | Medium | Start with user-provided type labels; backend analysis as enhancement later |
| **Multi-angle geometry hallucination** — models may generate impossible spaces from DNA alone | High | Include spatial constraints in DNA; validate output geometry |
| **Feature flag leakage** — V3 path may activate unexpectedly | Low | Explicit flag check; no automatic rollout |
| **Token budget overflow** — dense contracts exceed provider limits | Medium | Compiler budgets sections; truncates low-priority sections first |
| **Legacy regression** — V3 changes may break existing flows | High | ALL paths behind feature flag; legacy codepath unchanged; CI validates both |
| **Backend compatibility** — WebBackend may not accept structured contract | High | V3 contract is additive — can fall back to legacy payload; backend update needed for full benefit |
| **Performance regression** — contract building + compiler adds latency | Low | All contract logic is synchronous + under 50ms; no network calls added |

---

## M. MIGRATION PLAN

### Phase 1: Foundation (Week 1)
- [ ] Create `src/lib/prompt-engine/` directory structure
- [ ] Define all types (contract, compiler, DSL, provider, analyzer, observability)
- [ ] Implement `feature-flag.ts` with `PROMPT_ENGINE_V3_ENABLED`
- [ ] Implement ContractBuilder with default architectural contracts
- [ ] Add tests for contract building

### Phase 2: Compiler (Week 2)
- [ ] Implement PromptCompiler with all section builders
- [ ] Implement section ordering, priority, token budgeting
- [ ] Add GeminiProvider adapter
- [ ] Add FluxProvider adapter
- [ ] Add compiler tests

### Phase 3: DSL + Settings (Week 2–3)
- [ ] Implement all 6 tool DSLs (sceneedit, enhance, analysis, plancolor, img2img, multiangle)
- [ ] Implement SettingsNormalizer (Turkish UI → structured directives)
- [ ] Implement ReferenceAnalyzer (frontend-side classification)
- [ ] Add DSL + normalizer tests

### Phase 4: Integration (Week 3)
- [ ] Add `buildToolContract()` to `utils.ts` (V3 path alongside legacy)
- [ ] Add feature gate to `use-ai-studio-job-lifecycle.ts`
- [ ] Extend `aiStudioJobBodySchema` to accept `promptContract`
- [ ] Extend `AiStudioJobDocument` to include `promptVersion`, `contractSnapshot`
- [ ] Add `queueAiStudioJobV3()` to `nano-banana-service.ts`

### Phase 5: Observability (Week 3)
- [ ] Implement prompt logger (per-job contract snapshot + compiled prompt)
- [ ] Store prompt metadata in Supabase job document
- [ ] Add logger tests

### Phase 6: QA + Rollout (Week 4)
- [ ] Run all 10 QA test scenarios against V3 pipeline
- [ ] Compare V3 vs Legacy on architectural fidelity metrics
- [ ] Enable feature flag for internal testing
- [ ] Collect feedback on preservation/contamination improvements
- [ ] Gradual rollout: 10% → 50% → 100% users

### Phase 7: Backend Alignment (Week 4+)
- [ ] Coordinate with WebBackend team to accept `promptContract` field
- [ ] Update backend callable to use structured contract when available
- [ ] Fall back to legacy `extraNote` parsing for backward compatibility

---

## N. FINAL VERDICT

### Current State Assessment

The Archilya AI Studio prompt engine is functional but **architecturally immature**. It operates at what can be described as "MVP prompt concatenation" — stringing together Turkish text fragments into a single `extraNote` field with no structural contract, no reference scoping, no surgical constraint language, and no provider awareness. The UI is sophisticated; the prompt engineering is not.

### V3 Value Proposition

| Dimension | Current (MVP) | V3 Target | Improvement |
|-----------|--------------|-----------|-------------|
| Prompt structure | Flat Turkish text | Structured contract with sections | ∞ (qualitative) |
| Reference handling | Raw base64 + label | Semantic analysis + scoped transfer | 10x reduction in contamination |
| Scene editing | NL suggestion | Surgical DSL with locked/editable zones | 90%+ non-target zone preservation |
| Multi-angle | img2img hack | Dedicated design DNA extraction | 85%+ style continuity |
| Preservation | Flat Turkish text | Priority-scored mandatory/forbidden rules | 95%+ geometry preservation |
| Provider awareness | None | Adapter per provider (Gemini/Flux) | Optimal per-model formatting |
| Debuggability | Only extraNote stored | Full contract + compiled prompt log | Complete audit trail |
| Backward compatibility | N/A | Feature flag, legacy path preserved | Zero regression risk |

### Recommendation

**PROCEED WITH V3 IMPLEMENTATION** using the incremental migration approach described in Section M. The feature flag `PROMPT_ENGINE_V3_ENABLED` ensures zero regression risk. The legacy `buildToolNote()` path is preserved unchanged. All UI components remain untouched.

The V3 architecture addresses all 8 identified quality problems at their root cause — not through prompt engineering tricks, but through architectural transformation: contracts instead of concatenation, DSLs instead of template strings, analyzers instead of raw reference passthrough, and provider-aware compilation instead of one-size-fits-all formatting.

### Critical Success Factors

1. **Backend alignment is essential** — the WebBackend callable must be updated to accept and use `promptContract`. Without this, V3 provides better contract construction but the backend still parses Turkish NL from `extraNote`. Full benefit requires both sides.

2. **QA dataset must be run religiously** — the 10 test scenarios provide quantitative evidence. Without them, "better prompts" is an assertion, not a measurement.

3. **Feature flag discipline** — V3 must never activate accidentally. The flag should remain off in production until Phase 6 QA validation passes.

4. **Incremental, not rewrite** — the V3 pipeline is additive. Existing files are minimally modified. Legacy code paths are preserved. The worst-case outcome is "V3 doesn't improve things" — not "V3 breaks everything".

---

## APPENDIX: Key Constants Reference

### Tool IDs (Backend Contracts — NEVER CHANGE)
```
analysis, img2img, enhance, sceneedit, plancolor
```

### Tool → Provider Mapping
```
img2img    → Flux (via /api/ai-studio/flux-job)
enhance    → Flux (via /api/ai-studio/flux-job)
sceneedit  → Flux (via /api/ai-studio/flux-job)
analysis   → Gemini (via /api/ai-studio/jobs)
plancolor  → Gemini (via /api/ai-studio/jobs)
multi-angle → Flux (via /api/ai-studio/flux-job, backendToolId="img2img")
```

### Setting IDs → Directive Mappings (for Normalizer)
```
"golden-hour"      → { timeOfDay: "golden-hour", lightQuality: "warm" }
"natural-daylight" → { timeOfDay: "midday", lightQuality: "neutral" }
"twilight"         → { timeOfDay: "twilight", lightQuality: "cool" }
"overcast-soft"    → { timeOfDay: "overcast", lightQuality: "neutral" }
"warm-interior"    → { timeOfDay: "unspecified", lightQuality: "warm", interiorExterior: "interior" }
"cool-modern"      → { timeOfDay: "unspecified", lightQuality: "cool", interiorExterior: "interior" }
"dramatic-shadow"  → { timeOfDay: "unspecified", lightQuality: "dramatic", shadowIntensity: "hard" }
"sunny-morning"    → { timeOfDay: "morning", lightQuality: "warm", shadowIntensity: "soft" }

"natural-wood"     → { primaryMaterialFamily: "wood", tone: "warm", quality: "premium" }
"stone-marble"     → { primaryMaterialFamily: "stone", tone: "cool", quality: "premium" }
"metal-glass"      → { primaryMaterialFamily: "mixed", tone: "cool", quality: "premium" }
"concrete-minimal" → { primaryMaterialFamily: "concrete", tone: "neutral", quality: "standard" }
"warm-textile"     → { primaryMaterialFamily: "textile", tone: "warm", quality: "premium" }
"mixed-premium"    → { primaryMaterialFamily: "mixed", tone: "warm", quality: "premium" }

"low"              → { styleStrength: 0.3 }
"medium"           → { styleStrength: 0.6 }
"high"             → { styleStrength: 0.9 }
```
