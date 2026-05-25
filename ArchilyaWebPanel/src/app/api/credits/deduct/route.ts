import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callBackendCallableFromServer, requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { apiErrorResponse } from "@/lib/api/errors";
import { checkIdempotency, markIdempotencyCompleted, withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, creditMutationBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(creditMutationBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { accessToken, workspaceId, amount, idempotencyKey, description } = validated.data;
    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);
    await requireWorkspacePermission(verifiedUser.uid, workspaceId, "workspace.billing");

    const idempotencyStatus = await checkIdempotency(verifiedUser.uid, idempotencyKey);
    if (idempotencyStatus === "pending") {
      return NextResponse.json({ error: "İşlem zaten devam ediyor." }, { status: 409 });
    }
    if (idempotencyStatus === "completed") {
      return NextResponse.json({ ok: true });
    }

    // Pre-emptively ensure user profile document exists in backend to avoid race conditions/deduct failure
    try {
      await callBackendCallableFromServer("ensureUserProfile", accessToken, {
        email: verifiedUser.email,
        displayName: verifiedUser.name,
      });
    } catch (profileError) {
      console.warn("[credits/deduct/route] Profile pre-creation warning:", profileError);
    }

    await callBackendCallableFromServer("deductCredits", accessToken, { amount, description });
    await markIdempotencyCompleted(verifiedUser.uid, idempotencyKey, { ok: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[credits/deduct/route] Credit deduction failed:", error);
    return apiErrorResponse(error, {
      defaultMessage: "Kredi düşülemedi.",
      backendMessage: "Kredi işlemi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 20, windowMs: 60_000 });
