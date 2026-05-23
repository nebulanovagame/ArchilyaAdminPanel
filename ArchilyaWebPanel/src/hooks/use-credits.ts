"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { doc, type DocumentSnapshot, type Timestamp } from "firebase/firestore";

import { useAuth } from "@/components/providers/auth-provider";
import { useFirestoreDoc } from "@/hooks/use-firestore-doc";
import { useWorkspace } from "@/hooks/use-workspace";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { deductCreditsSecure, ensureUserProfileSecure, refundCreditsSecure } from "@/services/entitlement-service";

export type UserSubscriptionState = {
  status: string;
  planId: string;
  startAt: string | null;
  endAt: string | null;
  autoRenew: boolean;
  cancelledAt: string | null;
  pendingPlanId: string;
  billingCreditBalanceKurus: number;
};

export type UserCreditsState = {
  credits: number | null;
  plan: string;
} & UserSubscriptionState;

export const INITIAL_CREDITS = 150;

export function formatCredits(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("tr-TR");
}

function toDateString(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    const parsed = (value as Timestamp).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

export function useCredits() {
  const t = useTranslations();
  const { currentUser } = useAuth();
  const { activeWorkspace, deductPoolCredits, refundPoolCredits } = useWorkspace();
  const userRef = useMemo(
    () => (currentUser ? doc(getFirebaseFirestore(), "users", currentUser.uid) : null),
    [currentUser],
  );

  const mapSnapshot = useCallback((snapshot: DocumentSnapshot): UserCreditsState => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        credits: typeof data.credits === "number" ? data.credits : 0,
        plan: typeof data.plan === "string" ? data.plan : "free",
        status: String(data.status || "inactive"),
        planId: typeof data.planId === "string" ? data.planId : "",
        startAt: toDateString(data.startAt),
        endAt: toDateString(data.endAt),
        autoRenew: typeof data.autoRenew === "boolean" ? data.autoRenew : false,
        cancelledAt: toDateString(data.cancelledAt),
        pendingPlanId: typeof data.pendingPlanId === "string" ? data.pendingPlanId : "",
        billingCreditBalanceKurus: typeof data.billingCreditBalanceKurus === "number" ? data.billingCreditBalanceKurus : 0,
      };
    }

    if (currentUser) {
      void ensureUserProfileSecure({
        email: currentUser.email,
        displayName: currentUser.displayName,
      });
    }

    return {
      credits: null,
      plan: "free",
      status: "inactive",
      planId: "",
      startAt: null,
      endAt: null,
      autoRenew: false,
      cancelledAt: null,
      pendingPlanId: "",
      billingCreditBalanceKurus: 0,
    };
  }, [currentUser]);

  const { data, loading } = useFirestoreDoc({
    ref: userRef,
    initialData: {
      credits: null as number | null,
      plan: "free",
      status: "inactive",
      planId: "",
      startAt: null,
      endAt: null,
      autoRenew: false,
      cancelledAt: null,
      pendingPlanId: "",
      billingCreditBalanceKurus: 0,
    } satisfies UserCreditsState,
    mapSnapshot,
  });

  const credits = data.credits;
  const plan = data.plan;
  const status = data.status;
  const planId = data.planId;
  const startAt = data.startAt;
  const endAt = data.endAt;
  const autoRenew = data.autoRenew;
  const cancelledAt = data.cancelledAt;
  const pendingPlanId = data.pendingPlanId;
  const billingCreditBalanceKurus = data.billingCreditBalanceKurus;

  return {
    credits,
    plan,
    status,
    planId,
    startAt,
    endAt,
    autoRenew,
    cancelledAt,
    pendingPlanId,
    billingCreditBalanceKurus,
    loading,
    INITIAL_CREDITS,
    hasEnough(amount: number) {
      if (activeWorkspace) {
        return Number(activeWorkspace.poolCredits || 0) >= amount;
      }

      return credits !== null && credits >= amount;
    },
    async deductCredits(amount: number, description = "AI operation") {
      if (!currentUser) throw new Error(t("errors.sessionRequired"));
      if (!activeWorkspace) throw new Error(t("errors.activeWorkspaceRequired"));

      if (activeWorkspace.poolCredits != null) {
        await deductPoolCredits(amount);
        return true;
      }

      if (credits === null) throw new Error(t("errors.creditsLoading"));
      if (credits < amount) {
        throw new Error(t("errors.insufficientCredits", { amount, credits }));
      }

      await deductCreditsSecure(activeWorkspace.id, amount, description);
      return true;
    },
    async refundCredits(amount: number, description = "AI operation refund") {
      if (!currentUser) throw new Error(t("errors.sessionRequired"));
      if (!activeWorkspace) throw new Error(t("errors.activeWorkspaceRequired"));

      if (activeWorkspace.poolCredits != null) {
        await refundPoolCredits(amount);
        return true;
      }

      await refundCreditsSecure(activeWorkspace.id, amount, description);
      return true;
    },
  };
}
