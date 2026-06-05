import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, photo_url, created_at, updated_at, credits, subscription_plan, subscription_status, total_spent")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const users = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      email: (p.email as string) || "",
      displayName: (p.display_name as string) || null,
      avatarUrl: (p.photo_url as string) || null,
      role: p.is_admin ? ("admin" as const) : ("user" as const),
      status: "active" as const,
      createdAt: (p.created_at as string) || new Date().toISOString(),
      lastSignInAt: null,
      workspaceCount: 0,
      totalCreditsUsed: (p.total_spent as number) || 0,
    }));

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error("Admin API /users error:", err);
    return NextResponse.json(
      { error: { message: "Kullanicilar yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
