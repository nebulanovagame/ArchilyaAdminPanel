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
    const { data, error } = await supabase
      .from("subscriptions")
      .select(`id, user_id, plan, status, current_period_start, current_period_end, created_at,
        profiles!user_id(email)`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const subscriptions = (data || []).map((s: Record<string, unknown>) => {
      const profiles = s.profiles as Record<string, unknown> | undefined;

      return {
        id: String(s.id),
        userEmail: (profiles?.email as string) || "",
        planName: (s.plan as string) || "",
        status: ((s.status as string) || "active") as "active" | "canceled" | "past_due" | "trialing",
        currentPeriodStart: (s.current_period_start as string) || new Date().toISOString(),
        currentPeriodEnd: (s.current_period_end as string) || new Date().toISOString(),
        amount: 0,
        currency: "TRY",
      };
    });

    return NextResponse.json({ data: subscriptions });
  } catch (err) {
    console.error("Admin API /subscriptions error:", err);
    return NextResponse.json(
      { error: { message: "Abonelik verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
