import { logEvent, type Analytics } from "firebase/analytics";
import { getFirebaseAnalytics } from "@/lib/firebase/client";

function getAnalytics(): Analytics | null {
  try {
    return getFirebaseAnalytics();
  } catch {
    return null;
  }
}

export function logLoginEvent(method: string) {
  const analytics = getAnalytics();
  if (!analytics) return;
  logEvent(analytics, "login", { method });
}

export function logAiGenerationSuccess(toolId: string) {
  const analytics = getAnalytics();
  if (!analytics) return;
  logEvent(analytics, "ai_generation_success", { tool_id: toolId });
}

export function logSubscriptionChanged(planId: string) {
  const analytics = getAnalytics();
  if (!analytics) return;
  logEvent(analytics, "subscription_changed", { plan_id: planId });
}
