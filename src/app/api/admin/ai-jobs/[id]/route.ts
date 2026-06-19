import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: job, error: jobError } = await supabase
      .from("ai_studio_jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: { message: "Is bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", (job as Record<string, unknown>).user_id)
      .single();

    const emailMap: Record<string, string> = {};
    if (profile) {
      emailMap[(profile as { id: string; email: string }).id] = (profile as { id: string; email: string }).email;
    }

    const { data: events, error: eventsError } = await supabase
      .from("ai_studio_job_events")
      .select("*")
      .eq("job_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (eventsError) console.warn("Admin API /ai-jobs/[id] events error:", eventsError);

    const statusMap: Record<string, string> = {
      pending: "queued", queued: "queued", running: "processing",
      completed: "completed", failed: "failed", cancelled: "canceled",
    };

    const j = job as Record<string, unknown>;
    const billing = (j.billing as Record<string, unknown> | null) || {};
    const deadLetter = (j.dead_letter as Record<string, unknown> | null) || null;

    const formattedJob = {
      id: String(j.id),
      type: j.tool_id === "render" || j.output_type === "image" ? "render" : "ai" as const,
      status: statusMap[(j.status as string) || ""] || (j.status as string) || "queued",
      rawStatus: (j.status as string) || "",
      userId: String(j.user_id || ""),
      userEmail: emailMap[String(j.user_id)] || String(j.user_id || ""),
      projectName: (j.metadata && typeof j.metadata === "object" && (j.metadata as Record<string, unknown>).projectName as string) || (j.tool_id as string) || "",
      toolId: String(j.tool_id || ""),
      outputType: String(j.output_type || ""),
      creditCost: Number(j.credit_cost) || 0,
      attemptCount: Number(j.attempt_count) || 0,
      progress: j.status === "completed" ? 100 : j.status === "running" ? 50 : j.status === "failed" ? 0 : 10,
      createdAt: String(j.created_at || ""),
      completedAt: (j.completed_at as string | null) || null,
      failedAt: (j.failed_at as string | null) || null,
      updatedAt: (j.updated_at as string | null) || null,
      errorMessage: (j.error_message as string | null) || null,
      lastAttemptError: (j.last_attempt_error as Record<string, unknown> | null) || null,
      deadLetter: deadLetter ? {
        reason: String(deadLetter.reason || ""),
        canManualRetry: deadLetter.can_manual_retry === true,
        finalError: (deadLetter.final_error as Record<string, unknown> | null) || null,
        lastFailedAt: (deadLetter.last_failed_at as string | null) || null,
        attempts: Number(deadLetter.attempts) || 0,
      } : null,
      billing: {
        status: String(billing.status || "not_charged"),
        amount: Number(billing.amount) || 0,
        refunded: billing.status === "refunded",
        refundedAt: (billing.refundedAt as string | null) || null,
        refundTransactionId: (billing.refundTransactionId as string | null) || null,
        refundError: (billing.refundError as Record<string, unknown> | null) || null,
        transactionId: (billing.transactionId as string | null) || null,
      },
    };

    return NextResponse.json({
      data: {
        job: formattedJob,
        events: (events || []).map((e: Record<string, unknown>) => ({
          id: String(e.id),
          eventType: String(e.event_type || ""),
          previousStatus: (e.previous_status as string | null) || null,
          newStatus: (e.new_status as string | null) || null,
          reason: (e.reason as string | null) || null,
          attempt: Number(e.attempt) || null,
          provider: (e.provider as string | null) || null,
          metadata: (e.metadata as Record<string, unknown> | null) || null,
          createdAt: String(e.created_at || ""),
        })),
      },
    });
  } catch (err) {
    console.error("Admin API /ai-jobs/[id] error:", err);
    return NextResponse.json(
      { error: { message: "AI is detayi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
