import { describe, expect, it } from "vitest";

import type { AiStudioToolId } from "@/lib/ai-studio/tools";
import type { CompiledPrompt, PromptContract, ProviderName, ProviderPrompt } from "../types";
import { PromptLogger } from "./logger";

describe("PromptLogger", () => {
  it("returns a valid PromptLog with all fields populated", () => {
    const logger = new PromptLogger();
    const { contract, compiled, providerPrompt } = createPromptFixtures();

    const log = logger.log("job-1", contract, compiled, providerPrompt);

    expect(log.jobId).toBe("job-1");
    expect(log.promptVersion).toBe(providerPrompt.promptVersion);
    expect(log.compilerVersion).toBe(compiled.compilerVersion);
    expect(log.contractHash).toBe(compiled.metadata.contractHash);
    expect(log.contractSnapshot).toEqual(contract);
    expect(log.contractSnapshot).not.toBe(contract);
    expect(log.compiledSections).toEqual(compiled.sections);
    expect(log.compiledSections).not.toBe(compiled.sections);
    expect(log.providerAdapter).toBe(providerPrompt.provider);
    expect(log.finalPrompt).toEqual(providerPrompt);
    expect(log.finalPrompt).not.toBe(providerPrompt);
    expect(new Date(log.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("retrieves a logged entry by job id", () => {
    const logger = new PromptLogger();
    const fixtures = createPromptFixtures();

    const log = logger.log("job-1", fixtures.contract, fixtures.compiled, fixtures.providerPrompt);

    expect(logger.getLog("job-1")).toEqual(log);
    expect(logger.getLog("missing-job")).toBeNull();
  });

  it("returns the requested number of recent logs", () => {
    const logger = new PromptLogger();

    logger.log("job-1", ...createLogArgs("img2img", "gemini"));
    logger.log("job-2", ...createLogArgs("enhance", "flux"));
    logger.log("job-3", ...createLogArgs("analysis", "openai"));

    expect(logger.getRecentLogs(2).map((log) => log.jobId)).toEqual(["job-2", "job-3"]);
    expect(logger.getRecentLogs(0)).toEqual([]);
    expect(logger.getRecentLogs().map((log) => log.jobId)).toEqual(["job-1", "job-2", "job-3"]);
  });

  it("returns aggregate stats by tool, provider, section count, and tokens", () => {
    const logger = new PromptLogger();

    logger.log("job-1", ...createLogArgs("img2img", "gemini", [10, 20]));
    logger.log("job-2", ...createLogArgs("img2img", "flux", [5, 15, 20]));
    logger.log("job-3", ...createLogArgs("analysis", "gemini", [30]));

    expect(logger.getStats()).toEqual({
      totalLogs: 3,
      byTool: { img2img: 2, analysis: 1 },
      byProvider: { gemini: 2, flux: 1 },
      avgSectionCount: 2,
      avgTokens: expect.closeTo(100 / 3),
    });
  });

  it("removes all entries on clear", () => {
    const logger = new PromptLogger();

    logger.log("job-1", ...createLogArgs("img2img", "gemini"));
    logger.log("job-2", ...createLogArgs("enhance", "flux"));
    logger.clear();

    expect(logger.getLog("job-1")).toBeNull();
    expect(logger.getRecentLogs()).toEqual([]);
    expect(logger.getStats()).toEqual({
      totalLogs: 0,
      byTool: {},
      byProvider: {},
      avgSectionCount: 0,
      avgTokens: 0,
    });
  });

  it("limits memory entries with ring buffer behavior", () => {
    const logger = new PromptLogger({ maxEntries: 2 });

    logger.log("job-1", ...createLogArgs("img2img", "gemini"));
    logger.log("job-2", ...createLogArgs("enhance", "flux"));
    logger.log("job-3", ...createLogArgs("analysis", "openai"));

    expect(logger.getLog("job-1")).toBeNull();
    expect(logger.getRecentLogs().map((log) => log.jobId)).toEqual(["job-2", "job-3"]);
    expect(logger.getStats().totalLogs).toBe(2);
  });
});

function createLogArgs(
  toolId: AiStudioToolId,
  provider: ProviderName,
  sectionTokens: number[] = [10, 20],
): [PromptContract, CompiledPrompt, ProviderPrompt] {
  const fixtures = createPromptFixtures({ toolId, provider, sectionTokens });

  return [fixtures.contract, fixtures.compiled, fixtures.providerPrompt];
}

function createPromptFixtures(options: {
  toolId?: AiStudioToolId;
  provider?: ProviderName;
  sectionTokens?: number[];
} = {}): { contract: PromptContract; compiled: CompiledPrompt; providerPrompt: ProviderPrompt } {
  const toolId = options.toolId ?? "img2img";
  const provider = options.provider ?? "gemini";
  const sectionTokens = options.sectionTokens ?? [12, 18];
  const sections = sectionTokens.map((tokens, index) => ({
    id: `section-${index + 1}`,
    priority: index === 0 ? "critical" as const : "medium" as const,
    heading: `SECTION ${index + 1}`,
    body: `Body ${index + 1}`,
    tokens,
    order: index,
  }));
  const totalTokens = sectionTokens.reduce((sum, tokens) => sum + tokens, 0);
  const contract: PromptContract = {
    version: "3.0.0",
    toolId,
    task: {
      type: "architectural-render",
      primaryGoal: "Render a refined architectural scene.",
      architecturalMode: "enhance",
      editScope: "full",
    },
    architecturalPreservation: {
      mandatory: [
        {
          element: "camera-transform",
          priority: "critical",
          description: "Preserve the camera transform.",
        },
      ],
      preferred: [],
      forbidden: [
        {
          action: "change-camera-angle",
          scope: "global",
          severity: "blocking",
        },
      ],
      lockedZones: [{ name: "Existing shell", reason: "Architectural structure must remain fixed." }],
      editableZones: [{ name: "Finishes", allowedChanges: ["material"], maxChangeIntensity: "moderate" }],
    },
    styleDirectives: {
      architecturalStyle: "modern minimal",
      colorPalette: ["warm white", "oak"],
      styleStrength: 0.8,
    },
    referencePolicy: {
      references: [],
      defaultBehavior: "style-and-material-only",
    },
    toolConstraints: {
      toolId,
      dslVersion: "3.0.0",
      constraints: { preserveGeometry: true },
    },
    variant: "default",
    userNote: "Keep the existing camera.",
  };
  const compiled: CompiledPrompt = {
    version: "3.0.0",
    compilerVersion: "3.0.0",
    sections,
    metadata: {
      contractHash: `contract-${toolId}-${provider}`,
      compiledAt: "2026-01-02T03:04:05.000Z",
      toolId,
      sectionCount: sections.length,
      totalTokens,
    },
  };
  const providerPrompt: ProviderPrompt = {
    provider,
    model: `${provider}-test-model`,
    systemPrompt: "You are an architectural prompt adapter.",
    userPrompt: "Render the scene.",
    negativePrompt: provider === "flux" ? "Do not alter geometry." : undefined,
    parameters: { temperature: 0.4 },
    sections,
    promptVersion: "3.0.0",
  };

  return { contract, compiled, providerPrompt };
}
