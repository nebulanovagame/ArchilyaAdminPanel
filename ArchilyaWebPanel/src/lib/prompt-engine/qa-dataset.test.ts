import { describe, expect, it } from "vitest";

import type { AiStudioToolId } from "@/lib/ai-studio/tools";

import { PromptCompiler } from "./compiler/compiler";
import { ContractBuilder } from "./contract/builder";
import { getToolDefaultPreservation } from "./contract/architectural-contract";
import { AnalysisDSL } from "./dsl/analysis-dsl";
import { EnhanceDSL } from "./dsl/enhance-dsl";
import { Img2imgDSL } from "./dsl/img2img-dsl";
import { MultiAngleDSL } from "./dsl/multiangle-dsl";
import { PlanColorDSL } from "./dsl/plancolor-dsl";
import { SceneEditDSL } from "./dsl/sceneedit-dsl";
import { FluxAdapter } from "./providers/flux-adapter";
import { GeminiAdapter } from "./providers/gemini-adapter";
import { ReferenceAnalyzer } from "./reference-analyzer/analyzer";
import type { ReferenceAnalyzerInput } from "./reference-analyzer/types";
import { SettingsNormalizer } from "./settings-normalizer/normalizer";
import type { NormalizerInput } from "./settings-normalizer/normalizer";
import type {
  AnalysisFocus,
  ArchitecturalPreservationContract,
  ChangeIntensity,
  CompiledPrompt,
  CompiledSection,
  ContractBuilderInput,
  ForbiddenActionName,
  PromptContract,
  ReportTone,
  ToolConstraintBlock,
} from "./types";

type TestContractOverrides = {
  analysisDirectives?: ContractBuilderInput["analysisDirectives"];
  analysisFocus?: AnalysisFocus[];
  colorPalette?: string[];
  enhancePreserve?: string[];
  multiAnglePreserve?: string[];
  palette?: string;
  planType?: string;
  presentationStyle?: string;
  referenceInputs?: ReferenceAnalyzerInput[];
  reportTone?: ReportTone;
  revisionType?: string;
  roomLabels?: boolean;
  scenePreserveAreas?: string[];
  styleParams?: NormalizerInput;
  task?: ContractBuilderInput["task"];
  userNote?: string;
};

describe("Prompt Engine V3 QA dataset", () => {
  it("TEST 1: SketchUp raw interior to premium render preserves geometry", () => {
    const { contract, compiled } = runPipeline("img2img", {
      styleParams: {
        atmosphere: "golden-hour",
        materialLanguage: "natural-wood",
        architecturalStyle: "modern architectural interior",
      },
    });
    const task = getSection(compiled, "task-definition");
    const preservation = getSection(compiled, "mandatory-preservation");
    const forbidden = getSection(compiled, "forbidden-actions");
    const style = getSection(compiled, "style-directives");
    const gemini = new GeminiAdapter().format(compiled);

    expect(task.body).toContain("architectural-render");
    expect(contract.architecturalPreservation.mandatory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "camera-transform", priority: "critical" }),
      ]),
    );
    expect(preservation.body).toContain("[CRITICAL] camera-transform");
    expect(forbidden.body).toContain("Do not redesign the architecture");
    expect(forbidden.body).toContain("Do not change the camera angle");
    expect(style.body).toContain("Atmosphere: time of day golden-hour");
    expect(style.body).toContain("Material: family wood; tone warm; finish natural; quality premium.");
    expect(gemini.systemPrompt).toContain("=== MANDATORY PRESERVATION ===");
    expect(gemini.systemPrompt).toContain("[CRITICAL] camera-transform");
    expect(gemini.systemPrompt).toContain("IMPORTANT: Violating these constraints will result in REJECTION.");
  });

  it("TEST 2: reference style transfer avoids geometry contamination", () => {
    const { contract, compiled } = runPipeline("enhance", {
      styleParams: { styleStrength: "high", architecturalStyle: "warm premium minimalism" },
      referenceInputs: [
        { type: "style", label: "quiet luxury style reference", note: "Use the mood and aesthetic only." },
        { type: "material", label: "natural oak material board", note: "Use wood, stone, and texture cues." },
      ],
    });
    const reference = getSection(compiled, "reference-policy");
    const forbidden = getSection(compiled, "forbidden-actions");
    const style = getSection(compiled, "style-directives");
    const gemini = new GeminiAdapter().format(compiled);

    expect(contract.referencePolicy.references.map((item) => item.type)).toEqual(["style", "material"]);
    expect(reference.body).toContain("NOT geometry sources");
    expect(forbidden.body).toContain("Do not alter room proportions");
    expect(style.body).toContain("Style strength: 0.9.");
    expect(gemini.sections).toBe(compiled.sections);
  });

  it("TEST 3: scene edit changes only the ceiling with surgical precision", () => {
    const { contract, compiled } = runPipeline("sceneedit", {
      revisionType: "ceiling",
      scenePreserveAreas: ["perspective", "furniture-layout"],
    });
    const lockedZoneNames = contract.architecturalPreservation.lockedZones.map((zone) => zone.name);
    const task = getSection(compiled, "task-definition");
    const flux = new FluxAdapter().format(compiled);

    expect(lockedZoneNames).toEqual(expect.arrayContaining(["walls", "windows", "camera", "floor", "furniture"]));
    expect(contract.architecturalPreservation.editableZones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "ceiling", maxChangeIntensity: "moderate" }),
      ]),
    );
    expect(task.body).toContain("SURGICAL EDIT NOTE");
    expect(flux.negativePrompt).toContain("walls");
    expect(flux.negativePrompt).toContain("camera");
  });

  it("TEST 4: furniture replacement does not drift the layout", () => {
    const { contract, compiled } = runPipeline("sceneedit", {
      revisionType: "furniture",
      scenePreserveAreas: ["perspective", "floor-separation"],
    });
    const lockedZoneNames = contract.architecturalPreservation.lockedZones.map((zone) => zone.name);
    const forbiddenScope = asStringArray(contract.toolConstraints.constraints.FORBIDDEN_SCOPE);
    const forbidden = getSection(compiled, "forbidden-actions");
    const flux = new FluxAdapter().format(compiled);

    expect(lockedZoneNames).toEqual(expect.arrayContaining(["walls", "windows", "camera", "floor", "ceiling"]));
    expect(forbiddenScope).toEqual(expect.arrayContaining(["geometry-modify", "structural-change"]));
    expect(forbidden.body).toContain("Do not change fixed geometry");
    expect(forbidden.body).toContain("structural elements");
    expect(flux.sections).toBe(compiled.sections);
  });

  it("TEST 5: multi-angle generation preserves design DNA without geometry copy", () => {
    const { contract, compiled } = runPipeline("multi-angle", {
      multiAnglePreserve: ["wood", "metal", "lighting", "furniture", "wall", "atmosphere"],
    });
    const constraints = contract.toolConstraints.constraints;
    const gemini = new GeminiAdapter().format(compiled);

    expect(asStringArray(constraints.STYLE_CONTINUITY)).toEqual([
      "wood-tones",
      "metal-finishes",
      "lighting-mood",
      "furniture-style",
      "wall-material",
      "atmosphere",
    ]);
    expect(contract.task.primaryGoal).toContain("identical design DNA");
    expect(asStringArray(constraints.FORBIDDEN)).toContain("geometry-copy");
    expect(contract.task.primaryGoal).not.toContain("geometry copy");
    expect(gemini.systemPrompt).toContain("design DNA");
  });

  it("TEST 6: plan colorization remains readable", () => {
    const { contract, compiled } = runPipeline("plancolor", {
      planType: "floor-plan",
      palette: "warm-premium",
      presentationStyle: "clean-modern",
      roomLabels: true,
      colorPalette: ["warm-premium-neutrals"],
    });
    const constraints = contract.toolConstraints.constraints;
    const gemini = new GeminiAdapter().format(compiled);

    expect(constraints.COLOR_PALETTE).toBe("warm-premium-neutrals");
    expect(constraints.GRAPHIC_STYLE).toBe("clean-modern-graphics");
    expect(readabilityRoomLabels(constraints.READABILITY)).toBe(true);
    expect(contract.task.type).toBe("plan-color");
    expect(gemini.sections).toHaveLength(compiled.metadata.sectionCount);
  });

  it("TEST 7: analysis supports multiple critical focus areas", () => {
    const { contract, compiled } = runPipeline("analysis", {
      analysisFocus: ["material", "light", "composition"],
      reportTone: "critical",
      analysisDirectives: {
        focus: ["material", "light", "composition"],
        tone: "critical",
        depth: "deep",
      },
    });
    const analysis = getSection(compiled, "analysis-directives");
    const gemini = new GeminiAdapter().format(compiled);

    expect(contract.analysisDirectives?.focus).toEqual(["material", "light", "composition"]);
    expect(contract.analysisDirectives?.tone).toBe("critical");
    expect(contract.analysisDirectives?.depth).toBe("deep");
    expect(analysis.body).toContain("Focus areas: material, light, composition.");
    expect(analysis.body).toContain("Tone: critical.");
    expect(analysis.body).toContain("Depth: deep.");
    expect(gemini.userPrompt).toContain("=== ANALYSIS DIRECTIVES ===");
  });

  it("TEST 8: empty references keep default style-and-material-only policy", () => {
    const { contract, compiled } = runPipeline("enhance", { referenceInputs: [] });
    const reference = getSection(compiled, "reference-policy");
    const gemini = new GeminiAdapter().format(compiled);

    expect(contract.referencePolicy.references).toEqual([]);
    expect(contract.referencePolicy.defaultBehavior).toBe("style-and-material-only");
    expect(reference.body).toContain("No reference images were provided.");
    expect(gemini.sections).toBe(compiled.sections);
  });

  it("TEST 9: V3 structured output differs from legacy flat note text", () => {
    const { compiled } = runPipeline("img2img", {
      styleParams: {
        atmosphere: "golden-hour",
        materialLanguage: "natural-wood",
        architecturalStyle: "modern architectural style",
      },
      userNote: "Use the same inputs a legacy img2img tool note would carry.",
    });

    expect(Array.isArray(compiled.sections)).toBe(true);
    expect(compiled.sections.length).toBeGreaterThanOrEqual(4);
    expect(compiled.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["task-definition", "mandatory-preservation", "forbidden-actions", "style-directives"]),
    );
    expect(typeof compiled.sections).not.toBe("string");
    expect(compiled.sections.every((section) => typeof section.body === "string" && section.heading.length > 0)).toBe(true);
  });

  it("TEST 10: Gemini and Flux adapters preserve the same contract while formatting differently", () => {
    const { compiled } = runPipeline("img2img", {
      styleParams: {
        atmosphere: "golden-hour",
        materialLanguage: "natural-wood",
        architecturalStyle: "modern architectural interior",
      },
    });
    const gemini = new GeminiAdapter().format(compiled);
    const flux = new FluxAdapter().format(compiled);

    expect(gemini.systemPrompt).toContain("=== TASK DEFINITION ===");
    expect(gemini.systemPrompt).toContain("=== FORBIDDEN ACTIONS ===");
    expect(flux.negativePrompt).toContain("DO NOT:");
    expect(flux.negativePrompt).toContain("change the camera angle");
    expect(gemini.promptVersion).toBe(flux.promptVersion);
    expect(gemini.sections).toBe(compiled.sections);
    expect(flux.sections).toBe(compiled.sections);
    expect(gemini.sections).toHaveLength(compiled.metadata.sectionCount);
    expect(flux.sections).toHaveLength(compiled.metadata.sectionCount);
  });
});

function runPipeline(
  toolId: AiStudioToolId,
  overrides: TestContractOverrides = {},
): { contract: PromptContract; compiled: CompiledPrompt } {
  const contract = createTestContract(toolId, overrides);
  const compiled = new PromptCompiler().compile(contract);

  return { contract, compiled };
}

function createTestContract(toolId: AiStudioToolId, overrides: TestContractOverrides = {}): PromptContract {
  const normalizer = new SettingsNormalizer();
  const referenceAnalyzer = new ReferenceAnalyzer();
  const builder = new ContractBuilder();
  const normalizedStyle = normalizer.normalize({
    atmosphere: "golden-hour",
    materialLanguage: "natural-wood",
    styleStrength: "medium",
    architecturalStyle: "modern warm minimalism",
    ...overrides.styleParams,
  });
  const references = referenceAnalyzer.analyzeMultiple(overrides.referenceInputs ?? [], toolId);
  const dslBlock = buildDslBlock(toolId, overrides);
  const preservation = buildPreservation(toolId, dslBlock, overrides);
  const analysisDirectives = buildAnalysisDirectives(toolId, overrides);

  return builder.build({
    toolId,
    ...(overrides.task ? { task: overrides.task } : {}),
    ...(preservation ? { preservation } : {}),
    style: {
      ...(normalizedStyle.architecturalStyle ? { architecturalStyle: normalizedStyle.architecturalStyle } : {}),
      ...(normalizedStyle.atmosphere ? { atmosphere: normalizedStyle.atmosphere } : {}),
      ...(normalizedStyle.materialLanguage ? { materialLanguage: normalizedStyle.materialLanguage } : {}),
      ...(normalizedStyle.lightingStyle ? { lightingStyle: normalizedStyle.lightingStyle } : {}),
      ...(normalizedStyle.styleStrength !== undefined ? { styleStrength: normalizedStyle.styleStrength } : {}),
      ...(overrides.colorPalette ? { colorPalette: overrides.colorPalette } : {}),
    },
    references,
    toolConstraints: dslBlock.constraints,
    ...(analysisDirectives ? { analysisDirectives } : {}),
    ...(overrides.userNote ? { userNote: overrides.userNote } : {}),
  });
}

function buildDslBlock(toolId: AiStudioToolId, overrides: TestContractOverrides): ToolConstraintBlock {
  if (toolId === "img2img") {
    return new Img2imgDSL().buildConstraints({
      style: overrides.styleParams?.architecturalStyle ?? "modern",
      atmosphere: overrides.styleParams?.atmosphere ?? "golden-hour",
      materialLanguage: overrides.styleParams?.materialLanguage ?? "natural-wood",
    });
  }

  if (toolId === "enhance") {
    return new EnhanceDSL().buildConstraints({
      styleStrength: overrides.styleParams?.styleStrength ?? "medium",
      enhancePreserve: overrides.enhancePreserve ?? ["perspective", "massing", "window-position"],
    });
  }

  if (toolId === "sceneedit") {
    return new SceneEditDSL().buildConstraints({
      revisionType: overrides.revisionType ?? "general",
      scenePreserveAreas: overrides.scenePreserveAreas ?? ["perspective"],
    });
  }

  if (toolId === "multi-angle") {
    return new MultiAngleDSL().buildConstraints({
      multiAnglePreserve: overrides.multiAnglePreserve ?? ["wood", "lighting"],
    });
  }

  if (toolId === "plancolor") {
    return new PlanColorDSL().buildConstraints({
      planType: overrides.planType ?? "floor-plan",
      palette: overrides.palette ?? "warm-premium",
      presentationStyle: overrides.presentationStyle ?? "clean-modern",
      roomLabels: overrides.roomLabels ?? true,
    });
  }

  return new AnalysisDSL().buildConstraints({
    analysisFocus: overrides.analysisFocus ?? ["material", "light", "composition"],
    reportTone: overrides.reportTone ?? "professional",
  });
}

function buildPreservation(
  toolId: AiStudioToolId,
  dslBlock: ToolConstraintBlock,
  _overrides: TestContractOverrides,
): Partial<ArchitecturalPreservationContract> | undefined {
  if (toolId === "img2img") {
    const defaults = getToolDefaultPreservation(toolId);

    return {
      ...defaults,
      forbidden: appendForbidden(defaults.forbidden, "change-camera-angle"),
    };
  }

  if (toolId !== "sceneedit") {
    return undefined;
  }

  const defaults = getToolDefaultPreservation(toolId);
  const editTarget = String(dslBlock.constraints.EDIT_TARGET ?? "requested-zone");
  const allowedScope = dslBlock.constraints.ALLOWED_SCOPE === "all"
    ? ["all-targeted-changes"]
    : asStringArray(dslBlock.constraints.ALLOWED_SCOPE);
  const changeIntensity = asChangeIntensity(dslBlock.constraints.CHANGE_INTENSITY);

  return {
    ...defaults,
    lockedZones: asStringArray(dslBlock.constraints.LOCKED_ZONES).map((name) => ({
      name,
      reason: `Preserve ${name} outside the ${editTarget} edit target.`,
    })),
    editableZones: [
      {
        name: editTarget,
        allowedChanges: allowedScope,
        maxChangeIntensity: changeIntensity,
      },
    ],
  };
}

function buildAnalysisDirectives(
  toolId: AiStudioToolId,
  overrides: TestContractOverrides,
): ContractBuilderInput["analysisDirectives"] | undefined {
  if (overrides.analysisDirectives) {
    return overrides.analysisDirectives;
  }

  if (toolId !== "analysis") {
    return undefined;
  }

  return {
    focus: overrides.analysisFocus ?? ["composition", "presentation"],
    tone: overrides.reportTone ?? "professional",
    depth: overrides.reportTone === "detailed" ? "deep" : "moderate",
  };
}

function appendForbidden(
  actions: ArchitecturalPreservationContract["forbidden"],
  action: ForbiddenActionName,
): ArchitecturalPreservationContract["forbidden"] {
  if (actions.some((item) => item.action === action)) {
    return actions;
  }

  return [...actions, { action, scope: "global", severity: "blocking" }];
}

function getSection(compiled: CompiledPrompt, id: string): CompiledSection {
  const section = compiled.sections.find((candidate) => candidate.id === id);

  if (!section) {
    throw new Error(`Expected compiled section ${id}`);
  }

  return section;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Expected a string array constraint");
  }

  return value;
}

function asChangeIntensity(value: unknown): ChangeIntensity {
  if (value === "subtle" || value === "moderate" || value === "significant") {
    return value;
  }

  throw new Error("Expected a valid change intensity");
}

function readabilityRoomLabels(value: unknown): boolean | undefined {
  if (typeof value !== "object" || value === null || !("roomLabels" in value)) {
    throw new Error("Expected plan readability constraints");
  }

  return (value as { roomLabels?: boolean }).roomLabels;
}
