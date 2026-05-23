import { serverTimestamp, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
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
    const { idToken, workspaceId } = validated.data;

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.billing");
    const { ref, state } = await getUserSubscriptionDocument(firebaseUser.uid);

    if (state.status === "cancelled" && state.autoRenew === false) {
      return NextResponse.json({
        success: true,
        message: "Aboneliğiniz zaten iptal edilmiş durumda.",
      });
    }

    await updateDoc(ref, buildSubscriptionMirrorUpdate({
      autoRenew: false,
      cancelledAt: serverTimestamp(),
      status: "cancelled",
    }));

    return NextResponse.json({
      success: true,
      message: "Abonelik yenilemesi iptal edildi. Erişiminiz dönem sonuna kadar devam edecek.",
    });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Abonelik iptal edilemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
