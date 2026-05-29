import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { isAiStudioToolId } from "@/lib/ai-studio/tools";
import { callBackendCallableFromServer } from "@/lib/supabase/callable";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, aiStudioJobBodySchema } from "@/lib/api/validation";

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

    if (!isAiStudioToolId(toolId)) {
      return NextResponse.json({ error: "Geçerli bir AI aracı (toolId) gönderin." }, { status: 400 });
    }

    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);

    // Pre-emptively ensure user profile document exists in backend to avoid race conditions/deduct failure
    try {
      await callBackendCallableFromServer("ensureUserProfile", accessToken, {
        email: verifiedUser.email,
        displayName: verifiedUser.name,
      });
    } catch (profileError) {
      console.warn("[ai-studio/jobs/route] Profile pre-creation warning:", profileError);
    }

    try {
      const result = await callBackendCallableFromServer("createAiStudioJobSecure", accessToken, {
        toolId,
        imagePart: body.imagePart,
        style: body.style || "",
        sceneEditMode: body.sceneEditMode || "",
        extraNote: body.extraNote || "",
        promptContract: promptContract || undefined,
        generationVariant: body.generationVariant || "default",
        imageUrls: body.imageUrls || [],
        referenceImages: body.referenceImages || [],
        scenePreserveAreas: body.scenePreserveAreas || [],
      });

      return NextResponse.json({ success: true, result });
    } catch (queueError) {
      return apiErrorResponse(queueError, {
        defaultMessage: "AI işi kuyruğa alınamadı.",
        backendMessage: "AI işi kuyruğa alınamadı. Lütfen tekrar deneyin.",
      });
    }
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "AI Stüdyo işlemi başarısız oldu." });
  }
}

export const POST = withRateLimit(handler, { limit: 5, windowMs: 60_000 });
