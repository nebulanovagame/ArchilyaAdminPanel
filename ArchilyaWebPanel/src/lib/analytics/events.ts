// Analytics placeholder — wire PostHog, Plausible, or custom tracking here.
// For now, emits structured console logs for beta observability.

type AnalyticsEvent = {
  name: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

function emit(event: AnalyticsEvent) {
  // In production, replace with PostHog.capture / Plausible / custom.
  if (process.env.NODE_ENV === "development") {
    console.log("[analytics]", event.name, event);
  }
}

export function logLoginEvent(method: string) {
  emit({ name: "login", timestamp: new Date().toISOString(), data: { method } });
}

export function logAiGenerationSuccess(toolId: string) {
  emit({ name: "ai_generation_success", timestamp: new Date().toISOString(), data: { toolId } });
}

export function logSubscriptionChanged(planId: string) {
  emit({ name: "subscription_changed", timestamp: new Date().toISOString(), data: { planId } });
}
