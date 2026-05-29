import { describe, expect, it } from "vitest";

import type { AiStudioToolId } from "@/lib/ai-studio/tools";

import { ContractBuilder } from "./builder";

const toolIds: AiStudioToolId[] = ["img2img", "enhance", "sceneedit", "multi-angle", "analysis", "plancolor"];

describe("ContractBuilder", () => {
  it("builds a valid PromptContract for each tool type", () => {
    const builder = new ContractBuilder();

    for (const toolId of toolIds) {
      const contract = builder.build({ toolId });

      expect(contract.version).toBe("3.0.0");
      expect(contract.toolId).toBe(toolId);
      expect(contract.task.primaryGoal).toBeTruthy();
      expect(contract.architecturalPreservation.mandatory.length).toBeGreaterThan(0);
      expect(contract.referencePolicy.defaultBehavior).toBe("style-and-material-only");
      expect(contract.toolConstraints.toolId).toBe(toolId);
      expect(contract.variant).toBe("default");
    }
  });

  it("sets the img2img task type to architectural-render", () => {
    const contract = new ContractBuilder().build({ toolId: "img2img" });

    expect(contract.task.type).toBe("architectural-render");
    expect(contract.task.primaryGoal).toBe("Transform architectural visualization with style and atmosphere");
  });

  it("keeps locked zones for sceneedit contracts", () => {
    const contract = new ContractBuilder().build({ toolId: "sceneedit" });

    expect(contract.task.type).toBe("scene-edit");
    expect(contract.task.editScope).toBe("surgical");
    expect(contract.architecturalPreservation.lockedZones.length).toBeGreaterThan(0);
  });

  it("maps enhance style settings into style directives", () => {
    const contract = new ContractBuilder().build({
      toolId: "enhance",
      style: {
        architecturalStyle: "modern warm minimalism",
        materialLanguage: {
          primaryMaterialFamily: "wood",
          tone: "warm",
          finish: "natural",
          quality: "premium",
        },
        styleStrength: 0.75,
      },
    });

    expect(contract.task.type).toBe("style-transfer");
    expect(contract.styleDirectives.architecturalStyle).toBe("modern warm minimalism");
    expect(contract.styleDirectives.materialLanguage?.primaryMaterialFamily).toBe("wood");
    expect(contract.styleDirectives.styleStrength).toBe(0.75);
  });

  it("preserves userNote", () => {
    const contract = new ContractBuilder().build({
      toolId: "plancolor",
      userNote: "Keep labels readable and presentation-ready.",
    });

    expect(contract.userNote).toBe("Keep labels readable and presentation-ready.");
  });

  it("throws when toolId is missing", () => {
    const builder = new ContractBuilder();

    expect(() => builder.build({} as never)).toThrow("toolId");
  });
});
