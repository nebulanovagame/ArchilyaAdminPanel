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

    // Operator semantics: one logical operation = one standalone job OR one
    // batch. Batch children (batch_id IS NOT NULL) are not independent
    // operations — an 8-photo batch reads as 1 active operation, not 8.
    // Batch detail stays inspectable via the /ai-batches admin view.
    const [
      { count: totalUsers },
      { count: activeWorkspaces },
      { count: activeSubscriptions },
      { count: pendingStandaloneJobs },
      { count: activeBatches },
      { data: creditData },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("workspaces").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("ai_studio_jobs").select("*", { count: "exact", head: true }).in("status", ["pending", "queued", "running"]).is("batch_id", null),
      supabase.from("ai_studio_batches").select("*", { count: "exact", head: true }).in("status", ["pending", "running"]),
      supabase.from("profiles").select("total_spent"),
    ]);

    const totalCreditUsage = (creditData || []).reduce(
      (sum: number, p: Record<string, unknown>) => sum + ((p.total_spent as number) || 0),
      0,
    );

    return NextResponse.json({
      data: {
        totalUsers: totalUsers || 0,
        activeWorkspaces: activeWorkspaces || 0,
        totalCreditUsage,
        activeSubscriptions: activeSubscriptions || 0,
        // Logical operations: standalone active jobs + active batches (each batch = 1).
        pendingRenderJobs: (pendingStandaloneJobs || 0) + (activeBatches || 0),
        pendingStandaloneJobs: pendingStandaloneJobs || 0,
        activeBatches: activeBatches || 0,
        systemStatus: "healthy" as const,
      },
    });
  } catch (err) {
    console.error("Admin API /dashboard error:", err);
    captureApiError(err, "admin/dashboard");
    return NextResponse.json(
      { error: { message: "Dashboard verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
