import { describe, expect, it } from "vitest";

import { ReferenceAnalyzer } from "./analyzer";

const ALWAYS_FORBIDDEN_TRANSFER = [
  "camera-angle",
  "wall-geometry",
  "window-positions",
  "room-proportions",
  "structural-elements",
];

describe("ReferenceAnalyzer", () => {
  const analyzer = new ReferenceAnalyzer();

  it("classifies material keyword references as material", () => {
    const reference = analyzer.analyze({ label: "Warm wood texture" }, 0, 1, "img2img");

    expect(reference.type).toBe("material");
  });

  it("defaults unclassified references to style", () => {
    const reference = analyzer.analyze({ label: "inspiration" }, 0, 1, "img2img");

    expect(reference.type).toBe("style");
  });

  it("assigns high geometry risk to layout references", () => {
    const reference = analyzer.analyze({ type: "layout" }, 0, 1, "img2img");

    expect(reference.geometryRisk).toBe("high");
  });

  it("assigns low geometry risk to material references", () => {
    const reference = analyzer.analyze({ type: "material" }, 0, 1, "img2img");

    expect(reference.geometryRisk).toBe("low");
  });

  it("always forbids geometry-related transfer", () => {
    const reference = analyzer.analyze({ type: "material" }, 0, 1, "img2img");

    expect(reference.forbiddenTransfer).toEqual(expect.arrayContaining(ALWAYS_FORBIDDEN_TRANSFER));
  });

  it("returns one analyzed reference per input", () => {
    const references = analyzer.analyzeMultiple(
      [{ label: "wood material" }, { label: "ambient lamp" }, { label: "chair object" }],
      "img2img",
    );

    expect(references).toHaveLength(3);
  });

  it("normalizes weights so their total is at most 2.0", () => {
    const references = analyzer.analyzeMultiple(
      [
        { type: "material" },
        { type: "material" },
        { type: "material" },
        { type: "material" },
      ],
      "img2img",
    );
    const totalWeight = references.reduce((sum, reference) => sum + reference.weight, 0);

    expect(totalWeight).toBeLessThanOrEqual(2.0);
  });
});
