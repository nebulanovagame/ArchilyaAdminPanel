import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/data/pricing-data";

import type { ProrationQuote, SubscriptionPlanId } from "./types";

export type { ProrationQuote };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const FALLBACK_PLAN: SubscriptionPlan = SUBSCRIPTION_PLANS[0] ?? {
  id: "free",
  name: "Free",
  title: "Free",
  description: "",
  price: 0,
  credits: 0,
  storage: "",
  projects: "",
  iconKey: "",
  color: "",
  features: [],
  cta: "",
};

function isSubscriptionPlanId(value: string): value is SubscriptionPlanId {
  return value === "free" || value === "solo" || value === "pro" || value === "studio";
}

export function getPlanById(planId: string | null | undefined): SubscriptionPlan {
  if (!planId || !isSubscriptionPlanId(planId)) {
    return FALLBACK_PLAN;
  }

  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) ?? FALLBACK_PLAN;
}

export function daysBetween(startAt: Date | null | undefined, endAt: Date | null | undefined): number {
  if (!(startAt instanceof Date) || !(endAt instanceof Date)) {
    return 0;
  }

  const diff = endAt.getTime() - startAt.getTime();
  if (!Number.isFinite(diff) || diff <= 0) {
    return 0;
  }

  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

export function roundKurus(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function calculateProrationQuote(
  currentPlanId: string | null | undefined,
  targetPlanId: string | null | undefined,
  subscriptionStartAt: Date | null | undefined,
  subscriptionEndAt: Date | null | undefined,
  billingCreditBalanceKurus: number,
): ProrationQuote {
  const currentPlan = getPlanById(currentPlanId);
  const targetPlan = getPlanById(targetPlanId);
  const currentPlanIdNormalized = currentPlan.id as SubscriptionPlanId;
  const targetPlanIdNormalized = targetPlan.id as SubscriptionPlanId;
  const daysRemaining = daysBetween(new Date(), subscriptionEndAt ?? null);
  const totalDays = daysBetween(subscriptionStartAt ?? null, subscriptionEndAt ?? null);
  const safeCreditBalance = roundKurus(billingCreditBalanceKurus);

  if (currentPlanIdNormalized === targetPlanIdNormalized || totalDays === 0 || daysRemaining === 0) {
    return {
      changeType: "none",
      amountDueKurus: 0,
      billingCreditKurus: safeCreditBalance,
      effectiveAt: null,
      daysRemaining,
      currentPlanId: currentPlanIdNormalized,
      targetPlanId: targetPlanIdNormalized,
    };
  }

  const currentPriceKurus = roundKurus(currentPlan.price * 100);
  const targetPriceKurus = roundKurus(targetPlan.price * 100);
  const priceDifferenceKurus = targetPriceKurus - currentPriceKurus;
  const ratio = totalDays > 0 ? daysRemaining / totalDays : 0;

  if (priceDifferenceKurus > 0) {
    return {
      changeType: "upgrade",
      amountDueKurus: roundKurus(priceDifferenceKurus * ratio),
      billingCreditKurus: safeCreditBalance,
      effectiveAt: new Date(),
      daysRemaining,
      currentPlanId: currentPlanIdNormalized,
      targetPlanId: targetPlanIdNormalized,
    };
  }

  if (priceDifferenceKurus < 0) {
    return {
      changeType: "downgrade",
      amountDueKurus: 0,
      billingCreditKurus: safeCreditBalance + roundKurus(Math.abs(priceDifferenceKurus) * ratio),
      effectiveAt: subscriptionEndAt ?? null,
      daysRemaining,
      currentPlanId: currentPlanIdNormalized,
      targetPlanId: targetPlanIdNormalized,
    };
  }

  return {
    changeType: "none",
    amountDueKurus: 0,
    billingCreditKurus: safeCreditBalance,
    effectiveAt: null,
    daysRemaining,
    currentPlanId: currentPlanIdNormalized,
    targetPlanId: targetPlanIdNormalized,
  };
}
