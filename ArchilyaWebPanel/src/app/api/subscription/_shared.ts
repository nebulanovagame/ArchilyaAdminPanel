import type { SubscriptionPlanId, SubscriptionStatus } from "@/lib/subscription/types";

const SUBSCRIPTION_PLAN_IDS = ["free", "solo", "pro", "studio"] as const satisfies ReadonlyArray<SubscriptionPlanId>;

/** @deprecated Legacy timestamp format. Data should now arrive as ISO strings or Date objects. */
type LegacyTimestampLike = {
  toDate: () => Date;
};

export class ApiRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
  }
}

export type UserSubscriptionState = {
  planId: SubscriptionPlanId;
  status: SubscriptionStatus;
  startAt: Date | null;
  endAt: Date | null;
  autoRenew: boolean;
  cancelledAt: Date | null;
  pendingPlanId: SubscriptionPlanId | null;
  billingCreditBalanceKurus: number;
};

export type UserSubscriptionDocument = {
  data: Record<string, unknown>;
  state: UserSubscriptionState;
};

export function isApiRouteError(error: unknown): error is ApiRouteError {
  return error instanceof ApiRouteError;
}

export function isSubscriptionPlanId(value: string): value is SubscriptionPlanId {
  return SUBSCRIPTION_PLAN_IDS.some((planId) => planId === value);
}

function isLegacyTimestampLike(value: unknown): value is LegacyTimestampLike {
  return Boolean(
    value
    && typeof value === "object"
    && "toDate" in value
    && typeof value.toDate === "function",
  );
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (isLegacyTimestampLike(value)) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function readString(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return "";
}

function readBoolean(data: Record<string, unknown>, fallback: boolean, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return fallback;
}

function readNumber(data: Record<string, unknown>, fallback: number, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

function normalizeStatus(value: string): SubscriptionStatus {
  switch (value) {
    case "free":
    case "active":
    case "cancelled":
    case "expired":
    case "past_due":
      return value;
    default:
      return "free";
  }
}

function normalizePlanId(value: string, fallback: SubscriptionPlanId): SubscriptionPlanId {
  return isSubscriptionPlanId(value) ? value : fallback;
}

function normalizePendingPlanId(value: string): SubscriptionPlanId | null {
  return isSubscriptionPlanId(value) ? value : null;
}

export function readUserSubscriptionState(data: Record<string, unknown>): UserSubscriptionState {
  const planId = normalizePlanId(
    readString(data, "subscriptionPlanId", "planId", "plan"),
    "free",
  );

  return {
    planId,
    status: normalizeStatus(readString(data, "subscriptionStatus", "status")),
    startAt: toDate(data.subscriptionStartAt ?? data.startAt),
    endAt: toDate(data.subscriptionEndAt ?? data.endAt),
    autoRenew: readBoolean(data, false, "subscriptionAutoRenew", "autoRenew"),
    cancelledAt: toDate(data.subscriptionCancelledAt ?? data.cancelledAt),
    pendingPlanId: normalizePendingPlanId(readString(data, "subscriptionPendingPlanId", "pendingPlanId")),
    billingCreditBalanceKurus: readNumber(data, 0, "billingCreditBalanceKurus"),
  };
}

export async function getUserSubscriptionDocument(uid: string): Promise<UserSubscriptionDocument> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();

  if (error || !data) {
    throw new ApiRouteError(404, "Kullanıcı profili bulunamadı.");
  }

  return {
    data: data as Record<string, unknown>,
    state: readUserSubscriptionState(data as Record<string, unknown>),
  };
}

export function buildSubscriptionMirrorUpdate(input: {
  autoRenew?: boolean;
  billingCreditBalanceKurus?: number;
  cancelledAt?: null | string;
  pendingPlanId?: SubscriptionPlanId | null;
  planId?: SubscriptionPlanId;
  status?: SubscriptionStatus;
}) {
  const update: Record<string, string | number | boolean | null | undefined> = {
    updated_at: new Date().toISOString(),
  };

  if (input.status !== undefined) {
    update.subscriptionStatus = input.status;
    update.status = input.status;
  }

  if (input.planId !== undefined) {
    update.subscriptionPlanId = input.planId;
    update.planId = input.planId;
    update.plan = input.planId;
  }

  if (input.autoRenew !== undefined) {
    update.subscriptionAutoRenew = input.autoRenew;
    update.autoRenew = input.autoRenew;
  }

  if (input.cancelledAt !== undefined) {
    update.subscription_cancelled_at = input.cancelledAt;
    update.cancelledAt = input.cancelledAt;
  }

  if (input.pendingPlanId !== undefined) {
    update.subscriptionPendingPlanId = input.pendingPlanId;
    update.pendingPlanId = input.pendingPlanId;
  }

  if (input.billingCreditBalanceKurus !== undefined) {
    update.billingCreditBalanceKurus = input.billingCreditBalanceKurus;
  }

  return update;
}
