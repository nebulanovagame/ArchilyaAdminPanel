import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [{ data: workspaces, error }, { data: projects }, { data: members }] = await Promise.all([
      supabase
        .from("workspaces")
        .select(`id, name, admin_id, used_storage, is_active, deleted_at, created_at,
          profiles!admin_id(email, display_name)`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("projects").select("workspace_id").is("is_deleted", false),
      supabase.from("workspace_members").select("workspace_id"),
    ]);

    if (error) throw error;

    const projectCountMap: Record<string, number> = {};
    (projects || []).forEach((p: Record<string, unknown>) => {
      const wid = p.workspace_id as string;
      if (wid) projectCountMap[wid] = (projectCountMap[wid] || 0) + 1;
    });

    const memberCountMap: Record<string, number> = {};
    (members || []).forEach((m: Record<string, unknown>) => {
      const wid = m.workspace_id as string;
      if (wid) memberCountMap[wid] = (memberCountMap[wid] || 0) + 1;
    });

    const result = (workspaces || []).map((w: Record<string, unknown>) => {
      const profile = (w as any).profiles;
      return {
        id: String(w.id),
        name: (w.name as string) || "",
        ownerEmail: profile?.email || "",
        projectCount: projectCountMap[w.id as string] || 0,
        memberCount: memberCountMap[w.id as string] || 0,
        storageUsed: (w.used_storage as number) || 0,
        status: w.is_active ? ("active" as const) : ("suspended" as const),
        createdAt: (w.created_at as string) || new Date().toISOString(),
      };
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Admin API /workspaces error:", err);
    return NextResponse.json(
      { error: { message: "Workspace verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
