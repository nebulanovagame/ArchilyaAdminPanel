import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { isAiStudioToolId, getAiStudioToolCreditCost } from "@/lib/ai-studio/tools";
import { callFirebaseCallableFromServer } from "@/lib/firebase/callable-server";
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
    const idToken = body.idToken;
    const toolId = body.toolId;

    if (!isAiStudioToolId(toolId)) {
      return NextResponse.json({ error: "Geçerli bir AI aracı (toolId) gönderin." }, { status: 400 });
    }

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);

    // Pre-emptively ensure user profile document exists in Firestore to avoid race conditions/deduct failure
    try {
      await callFirebaseCallableFromServer("ensureUserProfile", idToken, {
        email: firebaseUser.email,
        displayName: firebaseUser.name,
      });
    } catch (profileError) {
      console.warn("[ai-studio/jobs/route] Profile pre-creation warning:", profileError);
    }

    const creditCost = getAiStudioToolCreditCost(toolId);

    try {
      await callFirebaseCallableFromServer("deductCredits", idToken, {
        amount: creditCost,
        description: `AI Stüdyo: ${toolId}`,
      });
    } catch (creditError) {
      console.error("[ai-studio/jobs/route] Credit deduction failed:", creditError);
      return apiErrorResponse(creditError, {
        defaultMessage: "Kredi işlemi tamamlanamadı. Lütfen tekrar deneyin.",
        backendMessage: "Kredi işlemi tamamlanamadı. Lütfen tekrar deneyin.",
      });
    }

    try {
      const result = await callFirebaseCallableFromServer("createAiStudioJobSecure", idToken, {
        toolId,
        imagePart: body.imagePart,
        style: body.style || "",
        sceneEditMode: body.sceneEditMode || "",
        extraNote: body.extraNote || "",
        generationVariant: body.generationVariant || "default",
        imageUrls: body.imageUrls || [],
        referenceImages: body.referenceImages || [],
      });

      return NextResponse.json({ success: true, result });
    } catch (queueError) {
      await callFirebaseCallableFromServer("refundCredits", idToken, {
        amount: creditCost,
        description: `AI Stüdyo iade: ${toolId} (queue failed)`,
      });

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
