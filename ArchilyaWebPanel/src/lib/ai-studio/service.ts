import { createClient } from "@/lib/supabase/client";

export type AiStudioJobFeedback = "positive" | "negative" | null;

export async function saveAiJobFeedback(
  uid: string,
  jobId: string,
  feedback: AiStudioJobFeedback,
): Promise<void> {
  if (!feedback || feedback === null) return;

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    console.warn("[ai-studio] saveAiJobFeedback: No session");
    throw new Error("Oturum bulunamadı.");
  }

  const response = await fetch("/api/ai-studio/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      jobId,
      feedback,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    console.warn("[ai-studio] saveAiJobFeedback error:", data?.error || response.statusText);
    throw new Error("Geri bildirim kaydedilemedi.");
  }
}
