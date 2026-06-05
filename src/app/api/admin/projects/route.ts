import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const projects = (data || []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      name: (p.name as string) || "",
      workspaceId: String((p as Record<string, unknown>).workspace_id || ""),
      ownerEmail: "",
      status: (p.status as string) || "active",
      fileCount: 0,
      totalSize: 0,
      createdAt: (p.created_at as string) || new Date().toISOString(),
      updatedAt: (p.updated_at as string) || new Date().toISOString(),
    }));

    return NextResponse.json({ data: projects });
  } catch (err) {
    console.error("Admin API /projects error:", err);
    return NextResponse.json(
      { error: { message: "Proje verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
