import { describe, expect, it } from "vitest";

import { ContractBuilder } from "../contract/builder";
import { PromptCompiler } from "./compiler";
import { SECTION_PRIORITY_ORDER } from "./types";

describe("PromptCompiler", () => {
  it("produces a CompiledPrompt from a valid PromptContract", () => {
    const contract = new ContractBuilder().build({
      toolId: "img2img",
      style: {
        architecturalStyle: "warm modern minimalism",
        atmosphere: {
          timeOfDay: "golden-hour",
          lightQuality: "warm",
          interiorExterior: "interior",
          shadowIntensity: "soft",
        },
      },
      references: [
        {
          id: "ref-1",
          type: "material",
          weight: 0.7,
          geometryRisk: "high",
          allowedTransfer: ["wood tone", "matte finish"],
          forbiddenTransfer: ["layout", "window positions"],
          materialSummary: "Warm natural oak with matte finish.",
        },
      ],
    });

    const compiled = new PromptCompiler().compile(contract);

    expect(compiled.version).toBe("3.0.0");
    expect(compiled.compilerVersion).toBe("3.0.0");
    expect(compiled.sections[0]?.heading).toBe("TASK DEFINITION");
    expect(compiled.sections.map((section) => section.heading)).toContain("REFERENCE POLICY");
  });

  it("includes the required minimum sections", () => {
    const contract = new ContractBuilder().build({ toolId: "enhance" });
    const compiled = new PromptCompiler().compile(contract);

    expect(compiled.sections).toHaveLength(5);
    expect(compiled.sections.map((section) => section.heading)).toEqual([
      "TASK DEFINITION",
      "MANDATORY PRESERVATION",
      "FORBIDDEN ACTIONS",
      "STYLE DIRECTIVES",
      "REFERENCE POLICY",
    ]);
  });

  it("orders sections by priority before order", () => {
    const contract = new ContractBuilder().build({ toolId: "analysis" });
    const compiled = new PromptCompiler().compile(contract);
    const priorityRanks = compiled.sections.map((section) => SECTION_PRIORITY_ORDER[section.priority]);

    expect(priorityRanks).toEqual([...priorityRanks].sort((left, right) => left - right));
    expect(compiled.sections.slice(0, 3).every((section) => section.priority === "critical")).toBe(true);
  });

  it("populates metadata fields", () => {
    const contract = new ContractBuilder().build({ toolId: "plancolor" });
    const compiled = new PromptCompiler({
      now: () => new Date("2026-01-02T03:04:05.000Z"),
    }).compile(contract);

    expect(compiled.metadata.contractHash).toMatch(/^contract-[a-z0-9]+$/);
    expect(compiled.metadata.compiledAt).toBe("2026-01-02T03:04:05.000Z");
    expect(compiled.metadata.toolId).toBe("plancolor");
    expect(compiled.metadata.sectionCount).toBe(compiled.sections.length);
    expect(compiled.metadata.totalTokens).toBe(
      compiled.sections.reduce((sum, section) => sum + section.tokens, 0),
    );
  });

  it("includes sceneedit locked and editable zones in the preservation section", () => {
    const contract = new ContractBuilder().build({ toolId: "sceneedit" });
    const compiled = new PromptCompiler().compile(contract);
    const preservation = compiled.sections.find((section) => section.heading === "MANDATORY PRESERVATION");

    expect(preservation?.body).toContain("LOCKED ZONES");
    expect(preservation?.body).toContain("Non-target architectural zones");
    expect(preservation?.body).toContain("EDITABLE ZONES");
    expect(preservation?.body).toContain("Requested edit zone");
  });

  it("includes an analysis section when analysis directives are present", () => {
    const contract = new ContractBuilder().build({ toolId: "analysis" });
    const compiled = new PromptCompiler().compile(contract);
    const analysis = compiled.sections.find((section) => section.heading === "ANALYSIS DIRECTIVES");

    expect(analysis).toBeDefined();
    expect(analysis?.body).toContain("Focus areas: composition, presentation.");
    expect(analysis?.body).toContain("Tone: professional.");
    expect(analysis?.body).toContain("Depth: moderate.");
  });
});
