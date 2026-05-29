import type { CompiledSection, ForbiddenActionName, PromptContract } from "../../types";

const NEGATIVE_STATEMENTS: Record<ForbiddenActionName, string> = {
  "redesign-architecture": "Do not redesign the architecture or change the design intent.",
  "reinterpret-layout": "Do not reinterpret, reorganize, or invent a different layout.",
  "hallucinate-openings": "Do not hallucinate new doors, windows, openings, or voids.",
  "alter-room-proportions": "Do not alter room proportions, scale, volume, or spatial relationships.",
  "change-geometry": "Do not change fixed geometry, structural lines, or architectural topology.",
  "add-windows": "Do not add windows, doors, skylights, or extra openings.",
  "remove-structural-elements": "Do not remove walls, columns, beams, slabs, stairs, or other structural elements.",
  "change-camera-angle": "Do not change the camera angle, lens feel, perspective, or viewpoint.",
};

export function buildForbiddenSection(contract: PromptContract): CompiledSection {
  const statements = contract.architecturalPreservation.forbidden.length > 0
    ? contract.architecturalPreservation.forbidden.map((item) => `- ${NEGATIVE_STATEMENTS[item.action]}`)
    : ["- Do not treat analysis, enhancement, or style transfer as permission to alter source geometry."];

  return {
    id: "forbidden-actions",
    priority: "critical",
    heading: "FORBIDDEN ACTIONS",
    body: ["DO NOT under any circumstances:", ...statements].join("\n"),
    tokens: 0,
    order: 2,
  };
}
