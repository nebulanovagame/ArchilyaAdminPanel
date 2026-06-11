import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";

const TYPE_MAP: Record<string, "grant" | "usage" | "refund" | "purchase"> = {
  credit_purchase: "purchase",
  credit_deduct: "usage",
  credit_refund: "refund",
  subscription_payment: "usage",
  subscription_refund: "refund",
};

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("credit_transactions")
      .select(`id, user_id, amount, type, description, balance_after, created_at,
        profiles!user_id(email)`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const credits = (data || []).map((c: Record<string, unknown>) => {
      const profiles = c.profiles as Record<string, unknown> | undefined;

      return {
        id: String(c.id),
        userEmail: (profiles?.email as string) || "",
        amount: (c.amount as number) || 0,
        type: TYPE_MAP[(c.type as string)] || "grant",
        description: (c.description as string) || "",
        createdAt: (c.created_at as string) || new Date().toISOString(),
      };
    });

    return NextResponse.json({ data: credits });
  } catch (err) {
    console.error("Admin API /credits error:", err);
    return NextResponse.json(
      { error: { message: "Kredi verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
