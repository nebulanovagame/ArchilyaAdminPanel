export const AI_STUDIO_TOOL_CREDIT_COSTS = {
  analysis: 5,
  img2img: 15,
  enhance: 15,
  sceneedit: 25,
  plancolor: 15,
  "multi-angle": 15,
} as const;

export type AiStudioToolId = keyof typeof AI_STUDIO_TOOL_CREDIT_COSTS;

export function isAiStudioToolId(value: string): value is AiStudioToolId {
  return value in AI_STUDIO_TOOL_CREDIT_COSTS;
}

export function getAiStudioToolCreditCost(toolId: AiStudioToolId): number {
  return AI_STUDIO_TOOL_CREDIT_COSTS[toolId];
}
