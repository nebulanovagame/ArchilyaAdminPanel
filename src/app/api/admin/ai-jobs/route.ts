import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const days = Math.min(Number(searchParams.get("days") || 7), 90);
    const limit = Math.min(Number(searchParams.get("limit") || 100), 200);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createAdminClient();
    let query = supabase
      .from("ai_studio_jobs")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const userIds = [...new Set((data || []).map((j: Record<string, unknown>) => j.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, email").in("id", userIds)
      : { data: [] };

    const emailMap: Record<string, string> = {};
    if (profiles) {
      for (const p of profiles as Array<{ id: string; email: string }>) {
        emailMap[p.id] = p.email;
      }
    }

    const statusMap: Record<string, string> = {
      pending: "queued", queued: "queued", running: "processing",
      completed: "completed", failed: "failed", cancelled: "canceled",
    };

    const jobs = (data || []).map((j: Record<string, unknown>) => {
      const billing = (j.billing as Record<string, unknown> | null) || {};
      const deadLetter = (j.dead_letter as Record<string, unknown> | null) || null;
      return {
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
    });

    return NextResponse.json({ data: jobs, meta: { days, limit, count: jobs.length } });
  } catch (err) {
    console.error("Admin API /ai-jobs error:", err);
    return NextResponse.json(
      { error: { message: "AI is verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}
