import type { UserSubscriptionState } from "@/hooks/use-credits";

function toDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toIsoString(value: unknown) {
  return toDate(value)?.toISOString() || null;
}

export function mapUserSubscription(snapshot: Record<string, unknown> | null | undefined): UserSubscriptionState {
  const data = snapshot || {};

  return {
    status: typeof data.status === "string" ? data.status : "inactive",
    planId: typeof data.planId === "string" ? data.planId : "",
    startAt: toIsoString(data.startAt),
    endAt: toIsoString(data.endAt),
    autoRenew: typeof data.autoRenew === "boolean" ? data.autoRenew : false,
    cancelledAt: toIsoString(data.cancelledAt),
    pendingPlanId: typeof data.pendingPlanId === "string" ? data.pendingPlanId : "",
    billingCreditBalanceKurus: typeof data.billingCreditBalanceKurus === "number" ? data.billingCreditBalanceKurus : 0,
  };
}

export function isSubscriptionActive(state: UserSubscriptionState) {
  return state.status === "active" && !isSubscriptionExpired(state);
}

export function isSubscriptionExpired(state: UserSubscriptionState) {
  if (!state.endAt) return false;
  const endAt = new Date(state.endAt);
  return !Number.isNaN(endAt.getTime()) && endAt.getTime() < Date.now();
}

export function getDaysUntilExpiry(state: UserSubscriptionState) {
  if (!state.endAt) return 0;
  const endAt = new Date(state.endAt);
  if (Number.isNaN(endAt.getTime())) return 0;
  return Math.ceil((endAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
