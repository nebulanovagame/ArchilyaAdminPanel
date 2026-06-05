import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, photo_url, created_at, updated_at, credits, subscription_plan, subscription_status, total_spent")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Kullanici bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    const user = {
      id: data.id,
      email: data.email || "",
      displayName: data.display_name || null,
      avatarUrl: data.photo_url || null,
      role: data.is_admin ? ("admin" as const) : ("user" as const),
      status: "active" as const,
      createdAt: data.created_at || new Date().toISOString(),
      lastSignInAt: null,
      workspaceCount: 0,
      credits: data.credits || 0,
      totalCreditsUsed: Number(data.total_spent) || 0,
    };

    return NextResponse.json({ data: user });
  } catch (err) {
    console.error("Admin API /users/[id] error:", err);
    return NextResponse.json(
      { error: { message: "Kullanici yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
