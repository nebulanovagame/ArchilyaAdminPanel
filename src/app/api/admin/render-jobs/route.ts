import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_studio_jobs")
      .select("id, user_id, tool_id, status, created_at, completed_at, credit_cost")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const jobs = (data || []).map((j: Record<string, unknown>) => ({
      id: String(j.id),
      type: "ai" as const,
      status: (j.status as string) || "unknown",
      userEmail: "",
      projectName: (j.tool_id as string) || "",
      progress: j.status === "completed" ? 100 : j.status === "failed" ? 0 : 50,
      createdAt: (j.created_at as string) || new Date().toISOString(),
      completedAt: (j.completed_at as string) || null,
    }));

    return NextResponse.json({ data: jobs });
  } catch (err) {
    console.error("Admin API /render-jobs error:", err);
    return NextResponse.json(
      { error: { message: "Is verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
