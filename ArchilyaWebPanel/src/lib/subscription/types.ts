export type SubscriptionStatus = "free" | "active" | "cancelled" | "expired" | "past_due";

export type SubscriptionPlanId = "free" | "solo" | "pro" | "studio";

export type SubscriptionRecord = {
  status: SubscriptionStatus;
  planId: SubscriptionPlanId;
  startAt: Date | null;
  endAt: Date | null;
  autoRenew: boolean;
  cancelledAt: Date | null;
  pendingPlanId: SubscriptionPlanId | null;
  billingCreditBalanceKurus: number;
};

export type ProrationQuote = {
  changeType: "upgrade" | "downgrade" | "none";
  amountDueKurus: number;
  billingCreditKurus: number;
  effectiveAt: Date | null;
  daysRemaining: number;
  currentPlanId: SubscriptionPlanId;
  targetPlanId: SubscriptionPlanId;
};

export type ChangeSubscriptionResult = {
  success: boolean;
  checkoutFormContent?: string;
  token?: string;
  message?: string;
  scheduledDowngrade?: boolean;
};
