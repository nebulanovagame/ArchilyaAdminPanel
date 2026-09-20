import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

async function handler(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId") || undefined;

    const supabase = createAdminClient();
    let query = supabase
      .from("ai_studio_jobs")
      .select(`id, user_id, tool_id, status, metadata, created_at, completed_at, credit_cost,
        batch_id, batch_index,
        profiles!user_id(email)`)
      .order("created_at", { ascending: false })
      .limit(50);

    // Phase 8: belirli bir batch'in cocuk islerini getirme. Diger davranis aynen korunur.
    if (batchId) query = query.eq("batch_id", batchId);

    const { data, error } = await query;

    if (error) throw error;

    // Normalize statuses the same way the backend admin router's formatAiJob
    // does, so both paths render identical values.
    const statusMap: Record<string, string> = {
      pending: "queued",
      running: "processing",
      cancelled: "canceled",
    };

    // Phase 8: listedeki batch'lerin ozetini tek sorguda cek (N+1 yok).
    const batchIds = [...new Set(
      (data || [])
        .map((j: Record<string, unknown>) => j.batch_id as string | null)
        .filter((id): id is string => Boolean(id)),
    )];
    const batchMap: Record<string, {
      id: string; toolId: string; status: string;
      totalCount: number; completedCount: number; failedCount: number;
    }> = {};
    if (batchIds.length > 0) {
      const { data: batches, error: batchError } = await supabase
        .from("ai_studio_batches")
        .select("id, tool_id, status, total_count, completed_count, failed_count")
        .in("id", batchIds);
      if (batchError) throw batchError;
      for (const b of (batches || []) as Array<Record<string, unknown>>) {
        batchMap[String(b.id)] = {
          id: String(b.id),
          toolId: String(b.tool_id || ""),
          status: String(b.status || "pending"),
          totalCount: Number(b.total_count) || 0,
          completedCount: Number(b.completed_count) || 0,
          failedCount: Number(b.failed_count) || 0,
        };
      }
    }

    const jobs = (data || []).map((j: Record<string, unknown>) => {
      const profiles = j.profiles as Record<string, unknown> | undefined;
      const metadata = (j.metadata as Record<string, unknown> | null) || {};
      const rawStatus = (j.status as string) || "unknown";
      const jobBatchId = (j.batch_id as string | null) || null;

      return {
        id: String(j.id),
        type: "ai" as const,
        status: statusMap[rawStatus] || rawStatus,
        userEmail: (profiles?.email as string) || "",
        projectName: (metadata.projectName as string) || (j.tool_id as string) || "",
        progress: rawStatus === "completed" ? 100 : rawStatus === "failed" ? 0 : 50,
        createdAt: (j.created_at as string) || new Date().toISOString(),
        completedAt: (j.completed_at as string) || null,
        // Phase 8 ek alanlari: batch'siz islerde null — mevcut alanlar aynen korunur.
        batchId: jobBatchId,
        batchIndex: (j.batch_index as number | null) ?? null,
        batch: jobBatchId && batchMap[jobBatchId] ? batchMap[jobBatchId] : null,
      };
    });

    return NextResponse.json({ data: jobs });
  } catch (err) {
    console.error("Admin API /render-jobs error:", err);
    captureApiError(err, "admin/render-jobs");
    return NextResponse.json(
      { error: { message: "Is verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
