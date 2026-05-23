import { runTransaction } from "firebase/firestore";
import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callFirebaseCallableFromServer, requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { calculateProrationQuote, getPlanById, type ChangeSubscriptionResult } from "@/lib/subscription";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, subscriptionChangeBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

import {
  ApiRouteError,
  buildSubscriptionMirrorUpdate,
  getUserSubscriptionDocument,
  isSubscriptionPlanId,
  readUserSubscriptionState,
} from "../_shared";

type CheckoutFormResult = {
  checkoutFormContent?: string;
  token?: string;
};

function getCheckoutUserName(email: string | null, name: string | null) {
  const trimmedName = String(name || "").trim();
  if (trimmedName) {
    return trimmedName;
  }

  const emailPrefix = String(email || "").split("@")[0]?.trim();
  return emailPrefix || "Archilya Kullanıcısı";
}

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(subscriptionChangeBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { idToken, workspaceId, targetPlanId, quoteId } = validated.data;

    if (!isSubscriptionPlanId(targetPlanId)) {
      return NextResponse.json({ error: "Geçerli bir targetPlanId gönderin." }, { status: 400 });
    }

    if (quoteId !== undefined && !quoteId.trim()) {
      return NextResponse.json({ error: "quoteId boş olamaz." }, { status: 400 });
    }

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.billing");
    const { ref, state } = await getUserSubscriptionDocument(firebaseUser.uid);
    const quote = calculateProrationQuote(
      state.planId,
      targetPlanId,
      state.startAt,
      state.endAt,
      state.billingCreditBalanceKurus,
    );

    const targetPlan = getPlanById(targetPlanId);
    if (!isSubscriptionPlanId(targetPlan.id)) {
      return NextResponse.json({ error: "Geçersiz hedef plan." }, { status: 400 });
    }

    const hasFutureSubscriptionEnd = state.endAt instanceof Date && state.endAt.getTime() > Date.now();
    const requiresCheckout = quote.amountDueKurus > 0 || (
      targetPlan.id !== "free"
      && targetPlan.id !== state.planId
      && !hasFutureSubscriptionEnd
    );

    if (requiresCheckout) {
      const checkoutResult = await callFirebaseCallableFromServer<
        { planId: string; userEmail: string; userId: string; userName: string },
        CheckoutFormResult
      >("createIyzicoCheckoutForm", idToken, {
        planId: targetPlan.id,
        userEmail: sessionUser?.email ?? "",
        userId: firebaseUser.uid,
        userName: getCheckoutUserName(sessionUser?.email ?? null, sessionUser?.name ?? null),
      });

      if (!checkoutResult.token || !checkoutResult.checkoutFormContent) {
        throw new Error("Iyzico ödeme formu oluşturulamadı.");
      }

      return NextResponse.json({
        success: true,
        checkoutFormContent: checkoutResult.checkoutFormContent,
        token: checkoutResult.token,
        message: quote.amountDueKurus > 0
          ? "Plan yükseltme için ödeme formu hazırlandı."
          : "Yeni abonelik için ödeme formu hazırlandı.",
      } satisfies ChangeSubscriptionResult);
    }

    if (quote.changeType === "downgrade") {
      await runTransaction(getFirebaseFirestore(), async (transaction) => {
        const snap = await transaction.get(ref);
        const latestState = readUserSubscriptionState(snap.data() || {});
        const latestQuote = calculateProrationQuote(
          latestState.planId,
          targetPlanId,
          latestState.startAt,
          latestState.endAt,
          latestState.billingCreditBalanceKurus,
        );

        if (latestQuote.changeType !== "downgrade") {
          throw new ApiRouteError(409, "Abonelik durumu değişti. Lütfen tekrar deneyin.");
        }

        transaction.update(ref, buildSubscriptionMirrorUpdate({
          billingCreditBalanceKurus: latestQuote.billingCreditKurus,
          pendingPlanId: targetPlanId,
        }));
      });

      return NextResponse.json({
        success: true,
        scheduledDowngrade: true,
        message: "Plan değişikliği dönem sonunda uygulanmak üzere planlandı.",
      } satisfies ChangeSubscriptionResult);
    }

    return NextResponse.json({
      success: true,
      scheduledDowngrade: false,
      message: targetPlan.id === state.planId
        ? "Zaten bu planı kullanıyorsunuz."
        : "Plan değişikliği gerekmiyor.",
    } satisfies ChangeSubscriptionResult);
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Abonelik değişikliği işlenemedi.",
      backendMessage: "Abonelik ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
