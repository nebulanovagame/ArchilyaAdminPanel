import type { ToolConstraintBlock, ToolDSL } from "./types";

export type EnhanceDSLInput = {
  styleStrength: string;
  enhancePreserve: string[];
};

const STYLE_TRANSFER_MAP: Record<string, string> = {
  low: "subtle",
  medium: "balanced",
  high: "strong",
};

const PRESERVE_CONTRACT_MAP: Record<string, string> = {
  perspective: "camera-transform",
  massing: "massing",
  "window-position": "window-coordinates",
  "furniture-layout": "furniture-layout",
  "floor-separation": "floor-separation",
  "ceiling-form": "ceiling-height",
};

const FORBIDDEN = ["geometry-modify", "layout-change", "camera-move", "proportion-change"];
const QUALITY_UPGRADE = ["material-resolution", "lighting-realism", "texture-detail"];

function mapPreserveContract(enhancePreserve: string[]): string[] {
  return enhancePreserve.map((item) => PRESERVE_CONTRACT_MAP[item] ?? item);
}

export class EnhanceDSL implements ToolDSL<EnhanceDSLInput> {
  toolId = "enhance";
  dslVersion = "enhance-v1";

  buildConstraints(params: EnhanceDSLInput): ToolConstraintBlock {
    return {
      toolId: this.toolId,
      dslVersion: this.dslVersion,
      constraints: {
        STYLE_TRANSFER: STYLE_TRANSFER_MAP[params.styleStrength] ?? "balanced",
        PRESERVE_CONTRACT: mapPreserveContract(params.enhancePreserve),
        FORBIDDEN,
        QUALITY_UPGRADE,
      },
    };
  }
}
