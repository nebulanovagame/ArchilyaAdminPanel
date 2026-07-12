import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import type { FeedbackResponse } from "@/lib/api/types";

export const dynamic = "force-dynamic";

async function handler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id: userId } = await params;
    const url = new URL(_request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);

    const supabase = createAdminClient();

    const { data: feedbacks, error } = await supabase
      .from("ai_studio_jobs")
      .select("id, feedback, feedback_note, tool_id, created_at, updated_at")
      .eq("user_id", userId)
      .not("feedback", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[admin/users/feedback] Supabase error:", error.message);
      return NextResponse.json(
        { error: { message: "Geri bildirim verisi alinirken hata olustu", code: "database" } },
        { status: 500 },
      );
    }

    const response: FeedbackResponse = {
      entries: (feedbacks || []) as FeedbackResponse["entries"],
      total: (feedbacks || []).length,
    };

    return NextResponse.json({ data: response });
  } catch (err) {
    console.error("Admin API /users/[id]/feedback error:", err);
    return NextResponse.json(
      { error: { message: "Geri bildirim verisi alinirken hata olustu", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
