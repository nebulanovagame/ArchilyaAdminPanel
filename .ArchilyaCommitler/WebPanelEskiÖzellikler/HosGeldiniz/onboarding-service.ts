import { createClient } from "@/lib/supabase/client";

export async function checkHasSeenOnboarding(uid: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("has_seen_onboarding")
    .eq("id", uid)
    .single();

  if (error) {
    console.warn("[onboarding] checkHasSeenOnboarding error:", error.message);
    return false;
  }

  return data?.has_seen_onboarding === true;
}

export async function markOnboardingSeen(uid: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({
      has_seen_onboarding: true,
      onboarding_seen_at: new Date().toISOString(),
    })
    .eq("id", uid);

  if (error) {
    console.warn("[onboarding] markOnboardingSeen error:", error.message);
    throw new Error("Onboarding durumu güncellenemedi.");
  }
}
