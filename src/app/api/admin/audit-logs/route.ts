import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("workspace_activity_logs")
      .select(`*`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const logs = (data || []).map((l: Record<string, unknown>) => ({
      id: String(l.id),
      actorEmail: (l.actor_email as string) || "",
      action: (l.action as string) || "unknown",
      resource: (l.target_type as string) || "",
      resourceId: String((l.target_id as string) || ""),
      details: null,
      ipAddress: null,
      createdAt: (l.created_at as string) || new Date().toISOString(),
    }));

    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error("Admin API /audit-logs error:", err);
    return NextResponse.json(
      { error: { message: "Denetim kaydi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
