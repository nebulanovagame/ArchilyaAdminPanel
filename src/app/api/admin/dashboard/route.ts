import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createAdminClient();

    const [
      { count: totalUsers },
      { count: activeWorkspaces },
      { data: creditData },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("workspaces").select("*", { count: "exact", head: true }).eq("status", "active"),
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
        activeSubscriptions: 0,
        pendingRenderJobs: 0,
        systemStatus: "healthy" as const,
      },
    });
  } catch (err) {
    console.error("Admin API /dashboard error:", err);
    return NextResponse.json(
      { error: { message: "Dashboard verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
