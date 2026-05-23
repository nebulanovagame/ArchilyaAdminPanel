import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { performCleanup } from "./cleanup";
import { startRenderPipeline, estimateDepth, compareScenes, requestRevision } from "./render-pipeline";
import { runAiStudioFluxTool } from "./ai-studio";

initializeApp();

export const cleanupDeletedProjectData = onSchedule(
  {
    region: "europe-west1",
    schedule: "every day 02:00",
  },
  async () => {
    const summary = await performCleanup(getFirestore(), getStorage());
    logger.info("cleanupDeletedProjectData finished", summary);
  },
);

export { startRenderPipeline, estimateDepth, compareScenes, requestRevision, runAiStudioFluxTool };

// Flux / Kontext / Prompt Bridge servislerini dışarı aç
export {
  generateFluxPro11,
  fluxRequest,
  pollReplicateResult,
  ReplicateServiceError,
  REPLICATE_API_BASE_URL,
  REPLICATE_API_TOKEN,
  FLUX_11_PRO_MODEL,
} from "./flux-service";

export type { FluxPro11Options } from "./flux-service";

export {
  kontextEdit,
  kontextEditMultiReference,
  kontextSceneEdit,
  buildSceneEditInstruction,
  FLUX_KONTEXT_PRO_MODEL,
} from "./kontext-service";

export type { KontextEditOptions, SceneEditMode } from "./kontext-service";

export {
  translateToEnglish,
  buildSceneEditPrompt,
  preprocessPrompt,
  PromptBridgeError,
} from "./prompt-bridge";

export type { PromptBridgeOptions } from "./prompt-bridge";
