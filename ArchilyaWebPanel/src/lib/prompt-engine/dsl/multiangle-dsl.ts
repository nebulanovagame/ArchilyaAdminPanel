import type { ToolConstraintBlock, ToolDSL } from "./types";

export type MultiAngleDSLInput = {
  multiAnglePreserve: string[];
};

const STYLE_CONTINUITY_MAP: Record<string, string> = {
  wood: "wood-tones",
  metal: "metal-finishes",
  lighting: "lighting-mood",
  furniture: "furniture-style",
  wall: "wall-material",
  atmosphere: "atmosphere",
};

const DESIGN_DNA_EXTRACTION = [
  "material-language",
  "lighting-mood",
  "furniture-vocabulary",
  "color-palette",
  "presentation-style",
];

const FORBIDDEN = ["geometry-copy", "camera-copy"];

function mapStyleContinuity(multiAnglePreserve: string[]): string[] {
  return multiAnglePreserve.map((item) => STYLE_CONTINUITY_MAP[item] ?? item);
}

export class MultiAngleDSL implements ToolDSL<MultiAngleDSLInput> {
  toolId = "multi-angle";
  dslVersion = "multiangle-v1";

  buildConstraints(params: MultiAngleDSLInput): ToolConstraintBlock {
    return {
      toolId: this.toolId,
      dslVersion: this.dslVersion,
      constraints: {
        STYLE_CONTINUITY: mapStyleContinuity(params.multiAnglePreserve),
        DESIGN_DNA_EXTRACTION,
        CAMERA_VARIATION: "new-angle",
        FORBIDDEN,
      },
    };
  }
}
