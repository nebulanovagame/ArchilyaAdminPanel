import type { AiStudioToolId } from "@/lib/ai-studio/tools";

import type { ArchitecturalPreservationContract } from "../types";

const baseForbidden: ArchitecturalPreservationContract["forbidden"] = [
  { action: "redesign-architecture", scope: "global", severity: "blocking" },
  { action: "reinterpret-layout", scope: "global", severity: "blocking" },
  { action: "hallucinate-openings", scope: "global", severity: "blocking" },
];

const geometryForbidden: ArchitecturalPreservationContract["forbidden"] = [
  ...baseForbidden,
  { action: "alter-room-proportions", scope: "global", severity: "blocking" },
  { action: "change-geometry", scope: "global", severity: "blocking" },
  { action: "add-windows", scope: "global", severity: "blocking" },
  { action: "remove-structural-elements", scope: "global", severity: "blocking" },
];

const DEFAULT_PRESERVATION_CONTRACTS: Record<AiStudioToolId, ArchitecturalPreservationContract> = {
  img2img: {
    mandatory: [
      { element: "camera-transform", priority: "critical", description: "Preserve the original camera position, lens feel, and viewing direction." },
      { element: "architectural-topology", priority: "critical", description: "Keep all architectural relationships and structural organization unchanged." },
      { element: "opening-placement", priority: "critical", description: "Do not move, add, or remove doors, windows, or major openings." },
    ],
    preferred: [
      { element: "composition", priority: "high", description: "Maintain the original composition and image framing." },
      { element: "furniture-layout", priority: "medium", description: "Keep furniture placement close to the source unless explicitly requested." },
    ],
    forbidden: geometryForbidden,
    lockedZones: [],
    editableZones: [
      { name: "Style surface layer", allowedChanges: ["materials", "lighting", "atmosphere", "color palette"], maxChangeIntensity: "moderate" },
    ],
  },
  enhance: {
    mandatory: [
      { element: "architectural-topology", priority: "critical", description: "Preserve geometry, layout, and architectural relationships exactly." },
      { element: "perspective", priority: "critical", description: "Keep the source perspective and spatial proportions unchanged." },
      { element: "opening-placement", priority: "critical", description: "Preserve all opening positions and dimensions." },
    ],
    preferred: [
      { element: "composition", priority: "high", description: "Keep the source framing while improving visual quality." },
      { element: "furniture-layout", priority: "high", description: "Preserve movable object placement unless a style transfer requires minor surface changes." },
    ],
    forbidden: geometryForbidden,
    lockedZones: [],
    editableZones: [
      { name: "Style and material layer", allowedChanges: ["finish", "material style", "lighting mood", "render quality"], maxChangeIntensity: "moderate" },
    ],
  },
  sceneedit: {
    mandatory: [
      { element: "camera-transform", priority: "critical", description: "Preserve the original camera and viewpoint." },
      { element: "architectural-topology", priority: "critical", description: "Keep non-target architectural geometry unchanged." },
      { element: "room-boundaries", priority: "critical", description: "Do not alter room boundaries outside the editable target zone." },
    ],
    preferred: [
      { element: "composition", priority: "high", description: "Keep composition stable outside the edited area." },
      { element: "furniture-layout", priority: "medium", description: "Preserve furniture layout outside requested edit zones." },
    ],
    forbidden: geometryForbidden,
    lockedZones: [
      { name: "Non-target architectural zones", reason: "Scene edits must remain surgical and affect only explicitly requested areas." },
      { name: "Structural shell", reason: "Walls, openings, floor levels, and ceiling geometry are not editable by default." },
    ],
    editableZones: [
      { name: "Requested edit zone", allowedChanges: ["targeted object change", "surface replacement", "localized lighting adjustment"], maxChangeIntensity: "moderate" },
    ],
  },
  "multi-angle": {
    mandatory: [
      { element: "architectural-topology", priority: "critical", description: "Preserve the same design DNA, layout logic, and architectural relationships." },
      { element: "window-coordinates", priority: "critical", description: "Keep openings consistent with the original design across the new viewpoint." },
      { element: "massing", priority: "critical", description: "Maintain the same massing, volume, and proportions." },
    ],
    preferred: [
      { element: "furniture-layout", priority: "high", description: "Keep recognizable furniture placement and interior organization." },
      { element: "composition", priority: "medium", description: "Use a coherent architectural composition for the new camera angle." },
    ],
    forbidden: baseForbidden,
    lockedZones: [],
    editableZones: [
      { name: "Camera viewpoint", allowedChanges: ["camera angle", "framing", "visible side selection"], maxChangeIntensity: "significant" },
    ],
  },
  analysis: {
    mandatory: [
      { element: "composition", priority: "high", description: "Assess the existing composition without proposing geometry changes as facts." },
      { element: "architectural-topology", priority: "high", description: "Treat observed layout and geometry as fixed source information." },
    ],
    preferred: [
      { element: "perspective", priority: "medium", description: "Consider perspective quality and camera setup in the analysis." },
    ],
    forbidden: [],
    lockedZones: [],
    editableZones: [],
  },
  plancolor: {
    mandatory: [
      { element: "wall-graph", priority: "critical", description: "Preserve every wall line, boundary, and plan graph relationship." },
      { element: "room-boundaries", priority: "critical", description: "Keep all room boundaries and labels aligned with the source plan." },
      { element: "opening-placement", priority: "critical", description: "Do not move, add, or remove doors, windows, or openings." },
    ],
    preferred: [
      { element: "floor-separation", priority: "high", description: "Maintain clear floor and zone separation for presentation readability." },
      { element: "composition", priority: "medium", description: "Keep the plan presentation balanced and legible." },
    ],
    forbidden: geometryForbidden,
    lockedZones: [
      { name: "Plan linework", reason: "Floor plan geometry must remain exact while color is applied." },
    ],
    editableZones: [
      { name: "Plan presentation layer", allowedChanges: ["room color", "material tint", "presentation shading"], maxChangeIntensity: "moderate" },
    ],
  },
};

export function getToolDefaultPreservation(toolId: AiStudioToolId): ArchitecturalPreservationContract {
  const contract = DEFAULT_PRESERVATION_CONTRACTS[toolId];

  if (!contract) {
    throw new Error(`Unsupported prompt engine toolId: ${toolId}`);
  }

  return structuredClone(contract);
}
