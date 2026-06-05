import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, credits, total_spent, subscription_plan")
      .order("total_spent", { ascending: false })
      .limit(50);

    if (error) throw error;

    const credits = (data || []).map((p: Record<string, unknown>, i: number) => ({
      id: `cred-${i + 1}`,
      userEmail: (p.email as string) || "",
      amount: (p.credits as number) || 0,
      type: "grant" as const,
      description: "Mevcut bakiye",
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json({ data: credits });
  } catch (err) {
    console.error("Admin API /credits error:", err);
    return NextResponse.json(
      { error: { message: "Kredi verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
