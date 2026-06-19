import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days") || 1), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_studio_jobs")
      .select("status, tool_id, credit_cost, created_at, completed_at, queued_at, billing, dead_letter, failed_at, error_message, last_attempt_error")
      .gte("created_at", since);

    if (error) throw error;

    const rows = data || [];
    const total = rows.length;
    const counts: Record<string, number> = { pending: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    const toolCounts: Record<string, number> = {};
    let completedDurationsMs = 0;
    let completedCount = 0;
    let queuedWaitMs = 0;
    let queuedCount = 0;
    let refundCount = 0;
    let deadLetterCount = 0;
    let providerErrorCount = 0;

    for (const j of rows as Array<Record<string, unknown>>) {
      const status = String(j.status || "");
      counts[status] = (counts[status] || 0) + 1;
      const toolId = String(j.tool_id || "");
      toolCounts[toolId] = (toolCounts[toolId] || 0) + 1;

      if (status === "completed" && j.completed_at && j.created_at) {
        const duration = new Date(String(j.completed_at)).getTime() - new Date(String(j.created_at)).getTime();
        if (duration > 0) {
          completedDurationsMs += duration;
          completedCount += 1;
        }
      }

      if (j.queued_at && j.created_at) {
        const wait = new Date(String(j.queued_at)).getTime() - new Date(String(j.created_at)).getTime();
        if (wait >= 0) {
          queuedWaitMs += wait;
          queuedCount += 1;
        }
      }

      const billing = (j.billing as Record<string, unknown> | null) || {};
      if (billing.status === "refunded") refundCount += 1;

      const deadLetter = (j.dead_letter as Record<string, unknown> | null) || null;
      if (deadLetter) deadLetterCount += 1;

      const lastErr = (j.last_attempt_error as Record<string, unknown> | null) || null;
      if (lastErr && ["unavailable", "internal", "resource-exhausted", "permission-denied"].includes(String(lastErr.code))) {
        providerErrorCount += 1;
      }
    }

    const toolUsage = Object.entries(toolCounts)
      .map(([toolId, count]) => ({
        toolId,
        count,
        creditCost: Number((rows as Array<Record<string, unknown>>).find((r) => String(r.tool_id) === toolId)?.credit_cost) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      data: {
        periodDays: days,
        since,
        totalJobs: total,
        statusCounts: counts,
        completed: {
          count: completedCount,
          averageDurationMs: completedCount ? Math.round(completedDurationsMs / completedCount) : 0,
        },
        queue: {
          averageWaitMs: queuedCount ? Math.round(queuedWaitMs / queuedCount) : 0,
        },
        refundCount,
        refundRate: total ? Number((refundCount / total).toFixed(4)) : 0,
        deadLetterCount,
        providerErrorCount,
        providerErrorRate: total ? Number((providerErrorCount / total).toFixed(4)) : 0,
        toolUsage,
      },
    });
  } catch (err) {
    console.error("Admin API /ai-jobs/metrics error:", err);
    return NextResponse.json(
      { error: { message: "AI is metrikleri yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
