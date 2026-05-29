import { ReferenceClassifier } from "./classifiers";
import type { GeometryRisk, ReferenceAnalyzerInput, ReferenceBrief, ReferenceType } from "./types";
import { ReferenceWeighter } from "./weighting";

const ALWAYS_FORBIDDEN_TRANSFER = [
  "camera-angle",
  "wall-geometry",
  "window-positions",
  "room-proportions",
  "structural-elements",
] as const;

const HIGH_RISK_FORBIDDEN_TRANSFER = ["opening-placement", "massing"] as const;

const ALLOWED_TRANSFER_BY_TYPE: Record<ReferenceType, string[]> = {
  material: ["material-palette", "texture-style", "finish-quality"],
  style: ["color-palette", "atmosphere", "material-language", "lighting-mood"],
  object: ["object-shape", "object-style", "fixture-design"],
  lighting: ["light-temperature", "fixture-style", "shadow-pattern"],
  layout: ["furniture-arrangement", "spatial-flow"],
  scene: ["atmosphere", "presentation-style"],
};

export class ReferenceAnalyzer {
  private readonly classifier: ReferenceClassifier;
  private readonly weighter: ReferenceWeighter;

  constructor(classifier = new ReferenceClassifier(), weighter = new ReferenceWeighter()) {
    this.classifier = classifier;
    this.weighter = weighter;
  }

  analyze(input: ReferenceAnalyzerInput, index: number, totalCount: number, toolId: string): ReferenceBrief {
    const type = this.classifier.classifyReferenceType(input);
    const geometryRisk = this.classifier.assessGeometryRisk(type);
    const weight = this.weighter.calculateWeight(type, index, totalCount);

    return {
      id: this.buildReferenceId(index, input, toolId),
      type,
      weight,
      geometryRisk,
      allowedTransfer: this.buildAllowedTransfer(type, toolId),
      forbiddenTransfer: this.buildForbiddenTransfer(geometryRisk),
    };
  }

  analyzeMultiple(inputs: ReferenceAnalyzerInput[], toolId: string): ReferenceBrief[] {
    const references = inputs.map((input, index) => this.analyze(input, index, inputs.length, toolId));

    return this.weighter.normalizeWeights(references);
  }

  private buildAllowedTransfer(type: ReferenceType, _toolId: string): string[] {
    return [...ALLOWED_TRANSFER_BY_TYPE[type]];
  }

  private buildForbiddenTransfer(geometryRisk: GeometryRisk): string[] {
    if (geometryRisk === "high") {
      return [...ALWAYS_FORBIDDEN_TRANSFER, ...HIGH_RISK_FORBIDDEN_TRANSFER];
    }

    return [...ALWAYS_FORBIDDEN_TRANSFER];
  }

  private buildReferenceId(index: number, input: ReferenceAnalyzerInput, toolId: string): string {
    const scope = input.toolId ?? toolId;

    return `${scope}-reference-${index + 1}`;
  }
}
