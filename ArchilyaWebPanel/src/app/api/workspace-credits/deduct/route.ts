import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callBackendCallableFromServer, requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { apiErrorResponse } from "@/lib/api/errors";
import { checkIdempotency, markIdempotencyCompleted, withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, workspaceCreditMutationBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(workspaceCreditMutationBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { accessToken, workspaceId, amount, idempotencyKey } = validated.data;
    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);
    await requireWorkspacePermission(verifiedUser.uid, workspaceId, "workspace.billing");

    const idempotencyStatus = await checkIdempotency(verifiedUser.uid, idempotencyKey);
    if (idempotencyStatus === "pending") {
      return NextResponse.json({ error: "İşlem zaten devam ediyor." }, { status: 409 });
    }
    if (idempotencyStatus === "completed") {
      return NextResponse.json({ ok: true });
    }

    await callBackendCallableFromServer("deductWorkspacePoolCredits", accessToken, { workspaceId, amount });
    await markIdempotencyCompleted(verifiedUser.uid, idempotencyKey, { ok: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Workspace kredisi düşürülemedi.",
      backendMessage: "Workspace kredi işlemi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 20, windowMs: 60_000 });
