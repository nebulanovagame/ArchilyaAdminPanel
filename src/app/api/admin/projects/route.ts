import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .select(`id, name, workspace_id, owner_id, status, file_count, total_size, created_at, updated_at,
        profiles!owner_id(email)`)
      .is("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const projects = (data || []).map((p: Record<string, unknown>) => {
      const fileCount = (p.file_count as any) || { dwg: 0, img: 0, pdf: 0 };
      return {
        id: String(p.id),
        name: (p.name as string) || "",
        workspaceId: String((p.workspace_id as string) || ""),
        ownerEmail: ((p as any).profiles?.email as string) || "",
        status: (p.status as string) || "Taslak",
        fileCount: (fileCount.dwg || 0) + (fileCount.img || 0) + (fileCount.pdf || 0),
        totalSize: (p.total_size as number) || 0,
        createdAt: (p.created_at as string) || new Date().toISOString(),
        updatedAt: (p.updated_at as string) || new Date().toISOString(),
      };
    });

    return NextResponse.json({ data: projects });
  } catch (err) {
    console.error("Admin API /projects error:", err);
    return NextResponse.json(
      { error: { message: "Proje verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
