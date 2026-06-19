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
      .from("projects")
      .select(`id, name, workspace_id, owner_id, status, file_count, total_size, created_at, updated_at,
        profiles!owner_id(email)`)
      .is("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const projects = (data || []).map((p: Record<string, unknown>) => {
      const fileCount = (p.file_count as Record<string, number>) || { dwg: 0, img: 0, pdf: 0 };
      const pRecord = p as Record<string, unknown>;
      const profiles = pRecord.profiles as Record<string, unknown> | undefined;
      return {
        id: String(p.id),
        name: (p.name as string) || "",
        workspaceId: String((p.workspace_id as string) || ""),
        ownerEmail: (profiles?.email as string) || "",
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

export const GET = withRateLimit(handler, adminRateLimits.read);
