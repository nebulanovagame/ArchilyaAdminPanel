"use client";

import { startDepthEstimation } from "@/lib/ai-studio/render-pipeline";

export interface DepthEstimationInput {
  imageUrl: string;
  sceneId: string;
}

export interface DepthEstimationResult {
  jobId: string;
}

export async function estimateDepth(input: DepthEstimationInput): Promise<DepthEstimationResult> {
  return startDepthEstimation(input);
}
