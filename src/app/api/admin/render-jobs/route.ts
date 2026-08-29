import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

async function handler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_studio_jobs")
      .select(`id, user_id, tool_id, status, metadata, created_at, completed_at, credit_cost,
        profiles!user_id(email)`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Normalize statuses the same way the backend admin router's formatAiJob
    // does, so both paths render identical values.
    const statusMap: Record<string, string> = {
      pending: "queued",
      running: "processing",
      cancelled: "canceled",
    };

    const jobs = (data || []).map((j: Record<string, unknown>) => {
      const profiles = j.profiles as Record<string, unknown> | undefined;
      const metadata = (j.metadata as Record<string, unknown> | null) || {};
      const rawStatus = (j.status as string) || "unknown";

      return {
        id: String(j.id),
        type: "ai" as const,
        status: statusMap[rawStatus] || rawStatus,
        userEmail: (profiles?.email as string) || "",
        projectName: (metadata.projectName as string) || (j.tool_id as string) || "",
        progress: rawStatus === "completed" ? 100 : rawStatus === "failed" ? 0 : 50,
        createdAt: (j.created_at as string) || new Date().toISOString(),
        completedAt: (j.completed_at as string) || null,
      };
    });

    return NextResponse.json({ data: jobs });
  } catch (err) {
    console.error("Admin API /render-jobs error:", err);
    captureApiError(err, "admin/render-jobs");
    return NextResponse.json(
      { error: { message: "Is verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
