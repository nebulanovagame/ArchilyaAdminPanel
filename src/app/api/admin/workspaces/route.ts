import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const workspaces = (data || []).map((w: Record<string, unknown>) => ({
      id: String(w.id),
      name: (w.name as string) || "",
      ownerEmail: "",
      projectCount: 0,
      memberCount: 0,
      storageUsed: 0,
      status: (w.status as string) || "active",
      createdAt: (w.created_at as string) || new Date().toISOString(),
    }));

    return NextResponse.json({ data: workspaces });
  } catch (err) {
    console.error("Admin API /workspaces error:", err);
    return NextResponse.json(
      { error: { message: "Workspace verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
