import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const [profileResult, workspaceResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, is_admin, photo_url, created_at, updated_at, credits, subscription_plan, subscription_status, total_spent")
        .eq("id", id)
        .single(),
      supabase
        .from("workspace_members")
        .select("workspace_id, workspaces!inner(pool_credits, credits)")
        .eq("user_id", id),
    ]);

    const { data, error } = profileResult;
    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Kullanici bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    // Sum workspace pool credits; fallback to profiles.credits
    const workspaceCredits = (workspaceResult.data || []).reduce((sum, membership) => {
      const ws = membership.workspaces as { pool_credits?: number | null; credits?: number | null };
      return sum + (ws?.pool_credits ?? ws?.credits ?? 0);
    }, 0);

    const user = {
      id: data.id,
      email: data.email || "",
      displayName: data.display_name || null,
      avatarUrl: data.photo_url || null,
      role: data.is_admin ? ("admin" as const) : ("user" as const),
      status: "active" as const,
      createdAt: data.created_at || new Date().toISOString(),
      lastSignInAt: null,
      workspaceCount: (workspaceResult.data || []).length,
      credits: workspaceCredits || Number(data.credits) || 0,
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

export const GET = withRateLimit(handler, adminRateLimits.read);
