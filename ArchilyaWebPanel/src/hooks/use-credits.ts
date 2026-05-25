"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/providers/auth-provider";
import { useRealtimeDoc } from "@/hooks/use-realtime-doc";
import { useWorkspace } from "@/hooks/use-workspace";
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

  return null;
}

export function useCredits() {
  const t = useTranslations();
  const { currentUser } = useAuth();
  const { activeWorkspace, deductPoolCredits, refundPoolCredits } = useWorkspace();

  const mapRow = useCallback((row: Record<string, unknown>): UserCreditsState => {
    if (row && Object.keys(row).length > 0) {
      return {
        credits: typeof row.credits === "number" ? row.credits : 0,
        plan: typeof row.subscription_plan === "string" ? row.subscription_plan : "free",
        status: String(row.subscription_status || "inactive"),
        planId: typeof row.plan_id === "string" ? row.plan_id : "",
        startAt: toDateString(row.start_at),
        endAt: toDateString(row.end_at),
        autoRenew: typeof row.auto_renew === "boolean" ? row.auto_renew : false,
        cancelledAt: toDateString(row.cancelled_at),
        pendingPlanId: typeof row.pending_plan_id === "string" ? row.pending_plan_id : "",
        billingCreditBalanceKurus: typeof row.billing_credit_balance_kurus === "number" ? row.billing_credit_balance_kurus : 0,
      };
    }

    if (currentUser) {
      void ensureUserProfileSecure({
        email: currentUser.email,
        displayName: currentUser.name,
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

  const { data, loading } = useRealtimeDoc({
    table: "profiles",
    id: currentUser?.uid ?? null,
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
    mapRow,
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
