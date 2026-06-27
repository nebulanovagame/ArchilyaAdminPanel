import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "";
    const search = url.searchParams.get("search") || "";
    const days = Math.min(Number(url.searchParams.get("days")) || 30, 90);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const supabase = createAdminClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("workspace_activity_logs")
      .select("*", { count: "exact" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.eq("action", action);
    }

    if (search) {
      query = query.or(`actor_email.ilike.%${search}%,actor_name.ilike.%${search}%,target_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const logs = (data || []).map((l: Record<string, unknown>) => ({
      id: String(l.id),
      actorEmail: (l.actor_email as string) || "",
      actorName: (l.actor_name as string) || "",
      action: (l.action as string) || "unknown",
      category: (l.category as string) || "",
      resource: (l.target_type as string) || "",
      resourceId: String((l.target_id as string) || ""),
      resourceName: (l.target_name as string) || "",
      details: l.metadata ? JSON.stringify(l.metadata) : null,
      ipAddress: null,
      createdAt: (l.created_at as string) || new Date().toISOString(),
    }));

    return NextResponse.json({ data: logs, meta: { total: count || 0, offset, limit, days, action: action || "all", search } });
  } catch (err) {
    console.error("Admin API /audit-logs error:", err);
    return NextResponse.json(
      { error: { message: "Denetim kaydi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
