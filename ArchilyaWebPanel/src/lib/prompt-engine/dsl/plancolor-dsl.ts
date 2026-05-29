import type { ToolConstraintBlock, ToolDSL } from "./types";

export type PlanColorDSLInput = {
  planType: string;
  palette: string;
  presentationStyle: string;
  roomLabels: boolean;
};

const GRAPHIC_STYLE_MAP: Record<string, string> = {
  "clean-modern": "clean-modern-graphics",
  "architectural-board": "architectural-presentation-board",
  "real-estate": "real-estate-marketing-plan",
  "minimal-line": "minimal-linework",
};

const COLOR_PALETTE_MAP: Record<string, string> = {
  "warm-premium": "warm-premium-neutrals",
  monochrome: "monochrome-grayscale",
  "pastel-architecture": "soft-pastel-architecture",
  "luxury-real-estate": "luxury-real-estate-gold-neutral",
};

const PLAN_TYPE_MAP: Record<string, string> = {
  "floor-plan": "floor-plan",
  "site-plan": "site-plan",
  section: "architectural-section",
  elevation: "architectural-elevation",
};

const ANNOTATION_POLICY_MAP: Record<string, string> = {
  "floor-plan": "room-names-circulation-and-functional-zones",
  "site-plan": "site-boundaries-access-landscape-and-context",
  section: "levels-heights-cut-lines-and-material-zones",
  elevation: "facade-elements-material-zones-and-level-markers",
};

export class PlanColorDSL implements ToolDSL<PlanColorDSLInput> {
  toolId = "plancolor";
  dslVersion = "plancolor-v1";

  buildConstraints(params: PlanColorDSLInput): ToolConstraintBlock {
    return {
      toolId: this.toolId,
      dslVersion: this.dslVersion,
      constraints: {
        GRAPHIC_STYLE: GRAPHIC_STYLE_MAP[params.presentationStyle] ?? "clean-modern-graphics",
        COLOR_PALETTE: COLOR_PALETTE_MAP[params.palette] ?? "warm-premium-neutrals",
        PLAN_TYPE: PLAN_TYPE_MAP[params.planType] ?? "floor-plan",
        READABILITY: {
          roomLabels: params.roomLabels,
          labelPolicy: params.roomLabels ? "include-readable-room-labels" : "omit-room-labels",
        },
        ANNOTATION_POLICY: ANNOTATION_POLICY_MAP[params.planType] ?? "general-architectural-annotations",
      },
    };
  }
}
