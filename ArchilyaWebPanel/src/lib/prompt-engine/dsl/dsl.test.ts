import { describe, expect, it } from "vitest";

import type { ToolConstraintBlock } from "./types";
import { AnalysisDSL } from "./analysis-dsl";
import { EnhanceDSL } from "./enhance-dsl";
import { Img2imgDSL } from "./img2img-dsl";
import { MultiAngleDSL } from "./multiangle-dsl";
import { PlanColorDSL } from "./plancolor-dsl";
import { SceneEditDSL } from "./sceneedit-dsl";

function expectValidToolConstraintBlock(block: ToolConstraintBlock, toolId: string): void {
  expect(block.toolId).toBe(toolId);
  expect(block.dslVersion).toBeTruthy();
  expect(typeof block.dslVersion).toBe("string");
  expect(block.constraints).toEqual(expect.any(Object));
}

describe("Prompt Engine DSL builders", () => {
  const blocks = [
    new SceneEditDSL().buildConstraints({ revisionType: "ceiling", scenePreserveAreas: ["perspective"] }),
    new EnhanceDSL().buildConstraints({ styleStrength: "medium", enhancePreserve: ["perspective"] }),
    new AnalysisDSL().buildConstraints({ analysisFocus: ["material", "light"], reportTone: "professional" }),
    new PlanColorDSL().buildConstraints({
      planType: "floor-plan",
      palette: "warm-premium",
      presentationStyle: "clean-modern",
      roomLabels: true,
    }),
    new Img2imgDSL().buildConstraints({
      style: "modern",
      atmosphere: "golden-hour",
      materialLanguage: "natural-wood",
    }),
    new MultiAngleDSL().buildConstraints({ multiAnglePreserve: ["wood", "lighting"] }),
  ];

  it("returns valid ToolConstraintBlock objects for each DSL", () => {
    expectValidToolConstraintBlock(blocks[0], "sceneedit");
    expectValidToolConstraintBlock(blocks[1], "enhance");
    expectValidToolConstraintBlock(blocks[2], "analysis");
    expectValidToolConstraintBlock(blocks[3], "plancolor");
    expectValidToolConstraintBlock(blocks[4], "img2img");
    expectValidToolConstraintBlock(blocks[5], "multi-angle");
  });

  it("sets dslVersion on every DSL output", () => {
    expect(blocks.map((block) => block.dslVersion)).toEqual([
      "sceneedit-v1",
      "enhance-v1",
      "analysis-v1",
      "plancolor-v1",
      "img2img-v1",
      "multiangle-v1",
    ]);
  });

  it("maps sceneedit ceiling to the correct locked zones", () => {
    const block = new SceneEditDSL().buildConstraints({ revisionType: "ceiling", scenePreserveAreas: [] });

    expect(block.constraints.LOCKED_ZONES).toEqual([
      "walls",
      "windows",
      "camera",
      "floor",
      "furniture",
      "structural",
    ]);
    expect(block.constraints.EDIT_TARGET).toBe("ceiling");
  });

  it("adds always-forbidden enhance actions", () => {
    const block = new EnhanceDSL().buildConstraints({ styleStrength: "high", enhancePreserve: [] });

    expect(block.constraints.FORBIDDEN).toEqual([
      "geometry-modify",
      "layout-change",
      "camera-move",
      "proportion-change",
    ]);
  });

  it("adds multiangle design DNA extraction constraints", () => {
    const block = new MultiAngleDSL().buildConstraints({ multiAnglePreserve: ["wood"] });

    expect(block.constraints.DESIGN_DNA_EXTRACTION).toEqual([
      "material-language",
      "lighting-mood",
      "furniture-vocabulary",
      "color-palette",
      "presentation-style",
    ]);
  });
});
