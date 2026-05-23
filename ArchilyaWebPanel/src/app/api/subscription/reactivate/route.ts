import { updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, subscriptionReactivateBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

import { buildSubscriptionMirrorUpdate, getUserSubscriptionDocument } from "../_shared";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(subscriptionReactivateBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { idToken, workspaceId } = validated.data;

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.billing");
    const { ref, state } = await getUserSubscriptionDocument(firebaseUser.uid);
    const canReactivate = state.status === "cancelled"
      && state.endAt instanceof Date
      && state.endAt.getTime() > Date.now();

    if (!canReactivate) {
      return NextResponse.json(
        { error: "Yalnızca süresi dolmamış iptal edilmiş abonelikler yeniden etkinleştirilebilir." },
        { status: 400 },
      );
    }

    await updateDoc(ref, buildSubscriptionMirrorUpdate({
      autoRenew: true,
      cancelledAt: null,
      status: "active",
    }));

    return NextResponse.json({
      success: true,
      message: "Abonelik yeniden etkinleştirildi ve otomatik yenileme açıldı.",
    });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Abonelik yeniden etkinleştirilemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
