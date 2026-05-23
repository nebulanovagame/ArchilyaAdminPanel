import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callFirebaseCallableFromServer, requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, workspaceCreditMutationBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(workspaceCreditMutationBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { idToken, workspaceId, amount } = validated.data;
    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.billing");
    await callFirebaseCallableFromServer("refundWorkspacePoolCredits", idToken, { workspaceId, amount });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Workspace kredi iadesi yapılamadı.",
      backendMessage: "Workspace kredi iadesi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 20, windowMs: 60_000 });
