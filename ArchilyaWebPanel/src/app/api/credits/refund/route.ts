import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callBackendCallableFromServer, requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, creditMutationBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(creditMutationBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { accessToken, workspaceId, amount, description } = validated.data;
    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);
    await requireWorkspacePermission(verifiedUser.uid, workspaceId, "workspace.billing");
    await callBackendCallableFromServer("refundCredits", accessToken, { amount, description });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Kredi iadesi yapılamadı.",
      backendMessage: "Kredi iadesi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 20, windowMs: 60_000 });
