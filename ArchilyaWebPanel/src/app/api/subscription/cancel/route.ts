import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, subscriptionCancelBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

import { buildSubscriptionMirrorUpdate, getUserSubscriptionDocument } from "../_shared";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(subscriptionCancelBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { accessToken, workspaceId } = validated.data;

    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);
    await requireWorkspacePermission(verifiedUser.uid, workspaceId, "workspace.billing");
    const { state } = await getUserSubscriptionDocument(verifiedUser.uid);

    if (state.status === "cancelled" && state.autoRenew === false) {
      return NextResponse.json({
        success: true,
        message: "Aboneliğiniz zaten iptal edilmiş durumda.",
      });
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase
      .from("users")
      .update(buildSubscriptionMirrorUpdate({ autoRenew: false, cancelledAt: new Date().toISOString(), status: "cancelled" }))
      .eq("id", verifiedUser.uid);

    return NextResponse.json({
      success: true,
      message: "Abonelik yenilemesi iptal edildi. Erişiminiz dönem sonuna kadar devam edecek.",
    });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Abonelik iptal edilemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
