import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

/**
 * Phase 8 — toplu render batch listesi (operator gorunurlugu).
 * GET /api/admin/render-batches?status=running&limit=50
 * Mevcut /render-jobs yanitini degistirmez; bagimsiz ek endpoint.
 */
async function handler(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const supabase = createAdminClient();
    let query = supabase
      .from("ai_studio_batches")
      .select(`id, user_id, tool_id, status, total_count, completed_count, failed_count,
        credit_unit, created_at, updated_at, completed_at,
        profiles!user_id(email)`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const batches = (data || []).map((b: Record<string, unknown>) => {
      const profiles = b.profiles as Record<string, unknown> | undefined;
      return {
        id: String(b.id),
        userId: String(b.user_id || ""),
        userEmail: (profiles?.email as string) || "",
        toolId: String(b.tool_id || ""),
        status: String(b.status || "pending"),
        totalCount: Number(b.total_count) || 0,
        completedCount: Number(b.completed_count) || 0,
        failedCount: Number(b.failed_count) || 0,
        creditUnit: Number(b.credit_unit) || 0,
        createdAt: (b.created_at as string) || new Date().toISOString(),
        updatedAt: (b.updated_at as string) || null,
        completedAt: (b.completed_at as string) || null,
      };
    });

    return NextResponse.json({ data: batches });
  } catch (err) {
    console.error("Admin API /render-batches error:", err);
    captureApiError(err, "admin/render-batches");
    return NextResponse.json(
      { error: { message: "Toplu is verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
