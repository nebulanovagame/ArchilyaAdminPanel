import type { ToolConstraintBlock, ToolDSL } from "./types";

export type SceneEditDSLInput = {
  revisionType: string;
  scenePreserveAreas: string[];
};

type SceneEditMode = {
  editTarget: string;
  lockedZones: string[];
  allowedScope?: string[] | "all";
  changeIntensity: "subtle" | "moderate" | "significant";
};

const SCENE_EDIT_MODES: Record<string, SceneEditMode> = {
  ceiling: {
    editTarget: "ceiling",
    lockedZones: ["walls", "windows", "camera", "floor", "furniture", "structural"],
    allowedScope: ["material-change", "color-change", "lighting-change"],
    changeIntensity: "moderate",
  },
  lighting: {
    editTarget: "lighting",
    lockedZones: ["walls", "windows", "camera", "floor", "ceiling-material", "structural"],
    changeIntensity: "subtle",
  },
  material: {
    editTarget: "materials",
    lockedZones: ["walls", "windows", "camera", "structural"],
    allowedScope: ["texture-change", "color-change", "finish-change"],
    changeIntensity: "moderate",
  },
  furniture: {
    editTarget: "furniture",
    lockedZones: ["walls", "windows", "camera", "floor", "ceiling", "structural"],
    allowedScope: ["object-replace", "object-add", "object-remove"],
    changeIntensity: "significant",
  },
  floor: {
    editTarget: "floor",
    lockedZones: ["walls", "windows", "camera", "ceiling", "furniture", "structural"],
    changeIntensity: "moderate",
  },
  general: {
    editTarget: "all",
    lockedZones: ["perspective", "massing"],
    allowedScope: "all",
    changeIntensity: "significant",
  },
};

const PRESERVE_AREA_MAP: Record<string, string> = {
  perspective: "perspective",
  massing: "massing",
  "furniture-layout": "furniture-layout",
  "floor-separation": "floor-separation",
};

const FORBIDDEN_SCOPE = ["geometry-modify", "structural-change", "camera-move", "proportion-change"];

function mapPreserveAreas(scenePreserveAreas: string[]): string[] {
  return scenePreserveAreas.map((area) => PRESERVE_AREA_MAP[area] ?? area);
}

export class SceneEditDSL implements ToolDSL<SceneEditDSLInput> {
  toolId = "sceneedit";
  dslVersion = "sceneedit-v1";

  buildConstraints(params: SceneEditDSLInput): ToolConstraintBlock {
    const mode = SCENE_EDIT_MODES[params.revisionType] ?? SCENE_EDIT_MODES.general;

    return {
      toolId: this.toolId,
      dslVersion: this.dslVersion,
      constraints: {
        EDIT_TARGET: mode.editTarget,
        LOCKED_ZONES: mode.lockedZones,
        ALLOWED_SCOPE: mode.allowedScope ?? [],
        FORBIDDEN_SCOPE,
        CHANGE_INTENSITY: mode.changeIntensity,
        REFERENCE_POLICY: "material-transfer-only",
        PRESERVE_AREAS: mapPreserveAreas(params.scenePreserveAreas),
      },
    };
  }
}
