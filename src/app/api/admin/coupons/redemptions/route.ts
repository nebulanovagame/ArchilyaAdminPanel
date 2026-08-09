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
      .from("coupon_redemptions")
      .select(
        "id, redeemed_at, coupons(id, code, discount_type, discount_value), profiles(id, email, display_name)",
      )
      .order("redeemed_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Admin API /coupons/redemptions query error:", error);
      return NextResponse.json(
        { error: { message: "Kupon kullanımları sorgulanırken hata", code: "query_error" } },
        { status: 500 },
      );
    }

    const redemptions = (data || []).map((r: Record<string, unknown>) => {
      const coupon = r.coupons as Record<string, unknown> | null;
      const profile = r.profiles as Record<string, unknown> | null;
      return {
        id: r.id,
        code: coupon?.code ?? null,
        discountType: coupon?.discount_type ?? null,
        discountValue: coupon?.discount_value ?? null,
        email: profile?.email ?? null,
        displayName: profile?.display_name ?? null,
        redeemedAt: r.redeemed_at,
      };
    });

    return NextResponse.json({ data: redemptions });
  } catch (err) {
    console.error("Admin API /coupons/redemptions error:", err);
    captureApiError(err, "admin/coupons/redemptions");
    return NextResponse.json(
      { error: { message: "Kupon kullanımları yüklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
