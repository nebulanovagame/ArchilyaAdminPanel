import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { calculateProrationQuote, type ProrationQuote } from "@/lib/subscription/proration";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, subscriptionQuoteBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

import { getUserSubscriptionDocument, isSubscriptionPlanId } from "../_shared";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(subscriptionQuoteBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { idToken, workspaceId, targetPlanId } = validated.data;

    if (!isSubscriptionPlanId(targetPlanId)) {
      return NextResponse.json({ error: "Geçerli bir targetPlanId gönderin." }, { status: 400 });
    }

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.billing");
    const { state } = await getUserSubscriptionDocument(firebaseUser.uid);

    const quote: ProrationQuote = calculateProrationQuote(
      state.planId,
      targetPlanId,
      state.startAt,
      state.endAt,
      state.billingCreditBalanceKurus,
    );

    return NextResponse.json({ quote });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Abonelik teklifi hesaplanamadı." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
