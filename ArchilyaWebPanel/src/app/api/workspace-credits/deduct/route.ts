import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callFirebaseCallableFromServer, requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
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
    const { idToken, workspaceId, amount, idempotencyKey } = validated.data;
    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.billing");

    const idempotencyStatus = await checkIdempotency(firebaseUser.uid, idempotencyKey);
    if (idempotencyStatus === "pending") {
      return NextResponse.json({ error: "İşlem zaten devam ediyor." }, { status: 409 });
    }
    if (idempotencyStatus === "completed") {
      return NextResponse.json({ ok: true });
    }

    await callFirebaseCallableFromServer("deductWorkspacePoolCredits", idToken, { workspaceId, amount });
    await markIdempotencyCompleted(firebaseUser.uid, idempotencyKey, { ok: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Workspace kredisi düşürülemedi.",
      backendMessage: "Workspace kredi işlemi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 20, windowMs: 60_000 });
