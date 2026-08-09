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
    const now = new Date().toISOString();

    const [
      { count: totalCoupons },
      { count: activeCoupons },
      { count: expiredCoupons },
      { data: usedCountData },
    ] = await Promise.all([
      supabase.from("coupons").select("*", { count: "exact", head: true }),
      supabase.from("coupons").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("coupons").select("*", { count: "exact", head: true }).lt("expires_at", now),
      supabase.from("coupons").select("used_count"),
    ]);

    const totalRedemptions = (usedCountData || []).reduce(
      (sum: number, c: Record<string, unknown>) => sum + ((c.used_count as number) || 0),
      0,
    );

    return NextResponse.json({
      data: {
        totalCoupons: totalCoupons || 0,
        activeCoupons: activeCoupons || 0,
        totalRedemptions,
        expiredCoupons: expiredCoupons || 0,
      },
    });
  } catch (err) {
    console.error("Admin API /coupons/stats error:", err);
    captureApiError(err, "admin/coupons/stats");
    return NextResponse.json(
      { error: { message: "Kupon istatistikleri yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
