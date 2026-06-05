import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, subscription_plan, subscription_status, stripe_customer_id, created_at")
      .not("subscription_plan", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const subscriptions = (data || []).map((p: Record<string, unknown>, i: number) => ({
      id: `sub-${i + 1}`,
      userEmail: (p.email as string) || "",
      planName: (p.subscription_plan as string) || "",
      status: ((p.subscription_status as string) || "active") as "active" | "canceled" | "past_due" | "trialing",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      amount: 0,
      currency: "TRY",
    }));

    return NextResponse.json({ data: subscriptions });
  } catch (err) {
    console.error("Admin API /subscriptions error:", err);
    return NextResponse.json(
      { error: { message: "Abonelik verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
