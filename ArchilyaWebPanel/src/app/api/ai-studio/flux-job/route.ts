import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { aiStudioJobBodySchema, validateRequestBody } from "@/lib/api/validation";
import { getOptionalSessionUser } from "@/lib/auth/session";
import { callBackendCallableFromServer, requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";

const FLUX_TOOL_IDS = new Set(["img2img", "enhance", "sceneedit"]);

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(aiStudioJobBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const body = validated.data;
    const accessToken = body.accessToken;
    const promptContract = body.promptContract || undefined;
    const toolId = body.toolId;

    if (!FLUX_TOOL_IDS.has(toolId)) {
      return NextResponse.json({ error: "Bu AI aracı Flux üretim rotası için desteklenmiyor." }, { status: 400 });
    }

    await requireVerifiedSupabaseIdentity(sessionUser, accessToken);

    const result = await callBackendCallableFromServer("runAiStudioFluxTool", accessToken, {
      toolId,
      imagePart: body.imagePart,
      style: body.style || "",
      sceneEditMode: body.sceneEditMode || "",
      extraNote: body.extraNote || "",
      promptContract: promptContract || undefined,
      generationVariant: body.generationVariant || "default",
      referenceImages: body.referenceImages || [],
      scenePreserveAreas: body.scenePreserveAreas || [],
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Görsel üretim servisi şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin.",
      backendMessage: "Görsel üretim servisi şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 5, windowMs: 60_000 });
