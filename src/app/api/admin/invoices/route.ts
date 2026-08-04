import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { writeAdminAuditLog } from "@/lib/api/audit";
import { captureApiError } from "@/lib/api/sentry-bridge";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") || "";
}

async function getHandler(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    let query = supabase
      .from("payment_sessions")
      .select("id, user_id, user_email, user_name, amount, currency, type, plan_id, package_id, credit_amount, status, created_at, completed_at, invoiced_at, invoice_url, provider_status, payment_id, conversation_id", { count: "exact" })
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (status === "invoiced") {
      query = query.not("invoiced_at", "is", null);
    } else if (status === "pending") {
      query = query.is("invoiced_at", null);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("admin/invoices GET db error:", error.message);
      return NextResponse.json(
        { error: { message: "Faturalar yuklenemedi.", code: "internal" } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      items: data || [],
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    captureApiError(error, "admin/invoices GET");
    return NextResponse.json(
      { error: { message: "Faturalar yuklenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

async function patchHandler(request: Request) {
  try {
    const originError = rejectCrossSiteMutation(request);
    if (originError) return originError;

    const guard = await requireAdmin();
    if (guard instanceof NextResponse) return guard;

    const formData = await request.formData();
    const action = formData.get("action") as string;
    const idsJson = formData.get("ids") as string;

    if (!idsJson) {
      return NextResponse.json(
        { error: { message: "ids parametresi gerekli.", code: "validation" } },
        { status: 400 },
      );
    }

    const ids = JSON.parse(idsJson) as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: { message: "En az bir odeme secmelisiniz.", code: "validation" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    if (action === "mark_invoiced") {
      const invoiceFile = formData.get("invoice") as File | null;
      let invoiceUrl: string | null = null;

      if (invoiceFile && invoiceFile.size > 0) {
        if (invoiceFile.type !== "application/pdf") {
          return NextResponse.json(
            { error: { message: "Sadece PDF dosyasi yuklenebilir.", code: "validation" } },
            { status: 400 },
          );
        }
        if (invoiceFile.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { error: { message: "PDF dosyasi 5MB'dan kucuk olmalidir.", code: "validation" } },
            { status: 400 },
          );
        }

        const buffer = Buffer.from(await invoiceFile.arrayBuffer());
        const fileName = `invoice-${ids[0].slice(0, 8)}-${Date.now()}.pdf`;

        const { data: session } = await supabase
          .from("payment_sessions")
          .select("user_id")
          .eq("id", ids[0])
          .single();

        const userId = (session as { user_id?: string } | null)?.user_id || "unknown";
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(filePath, buffer, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          console.error("admin/invoices PATCH storage upload error:", uploadError.message);
          return NextResponse.json(
            { error: { message: "PDF yuklenemedi.", code: "internal" } },
            { status: 500 },
          );
        }

        const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(filePath);
        invoiceUrl = urlData?.publicUrl || null;
      }

      const updateData: Record<string, unknown> = { invoiced_at: now };
      if (invoiceUrl) updateData.invoice_url = invoiceUrl;

      const { error } = await supabase
        .from("payment_sessions")
        .update(updateData)
        .in("id", ids);

      if (error) {
        console.error("admin/invoices PATCH update error:", error.message);
        return NextResponse.json(
          { error: { message: "Fatura isaretleme basarisiz.", code: "internal" } },
          { status: 500 },
        );
      }

      // Audit log
      try {
        await writeAdminAuditLog(supabase, {
          actorId: guard.uid,
          actorEmail: guard.email,
          action: "invoice_mark",
          resource: "payment_session",
          resourceId: ids[0],
          details: { count: ids.length, invoiceUrl },
        });
      } catch (auditErr) {
        console.warn("admin/invoices PATCH audit log error:", auditErr);
      }

      // Send invoice email (non-blocking for the mutation response)
      let emailWarning = false;
      if (invoiceUrl) {
        const { data: emailSession } = await supabase
          .from("payment_sessions")
          .select("user_email, user_name, amount, type, plan_id, package_id, credit_amount, currency")
          .eq("id", ids[0])
          .single();

        const s = emailSession as { user_email: string; user_name?: string; amount: number; type: string; plan_id?: string; package_id?: string; credit_amount?: number; currency?: string } | null;
        if (s?.user_email) {
          const apiBaseUrl = getApiBaseUrl();
          if (!apiBaseUrl) {
            console.warn("admin/invoices PATCH: NEXT_PUBLIC_ADMIN_API_BASE_URL tanimsiz, e-posta atlanildi.");
            emailWarning = true;
          } else {
            try {
              const sessionClient = await createClient();
              const { data: { session: authSession } } = await sessionClient.auth.getSession();
              const accessToken = authSession?.access_token;

              if (!accessToken) {
                console.warn("admin/invoices PATCH: access token bulunamadi, e-posta atlanildi.");
                emailWarning = true;
              } else {
                const emailResponse = await fetch(`${apiBaseUrl}/call/sendInvoiceEmail`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    data: {
                      userEmail: s.user_email,
                      userName: s.user_name || "Degerli Kullanici",
                      amount: s.amount,
                      currency: s.currency || "TRY",
                      description: s.type === "plan" ? `${s.plan_id} Abonelik` : `${s.package_id} Ek Paket (${s.credit_amount || 0} kredi)`,
                      invoiceUrl,
                    },
                  }),
                });

                if (!emailResponse.ok) {
                  console.error("admin/invoices PATCH email send failed:", emailResponse.status);
                  captureApiError(new Error(`sendInvoiceEmail responded ${emailResponse.status}`), "admin/invoices email");
                  emailWarning = true;
                }
              }
            } catch (emailErr) {
              console.error("admin/invoices PATCH email send error:", emailErr);
              captureApiError(emailErr, "admin/invoices email");
              emailWarning = true;
            }
          }
        }
      }

      return NextResponse.json({ success: true, invoice_url: invoiceUrl, emailWarning });
    }

    if (action === "unmark_invoiced") {
      const { error } = await supabase
        .from("payment_sessions")
        .update({ invoiced_at: null, invoice_url: null })
        .in("id", ids);

      if (error) {
        console.error("admin/invoices PATCH unmark error:", error.message);
        return NextResponse.json(
          { error: { message: "Fatura islemi basarisiz.", code: "internal" } },
          { status: 500 },
        );
      }

      // Audit log
      try {
        await writeAdminAuditLog(supabase, {
          actorId: guard.uid,
          actorEmail: guard.email,
          action: "invoice_unmark",
          resource: "payment_session",
          resourceId: ids[0],
          details: { count: ids.length },
        });
      } catch (auditErr) {
        console.warn("admin/invoices PATCH audit log error:", auditErr);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: { message: "Gecersiz aksiyon.", code: "validation" } },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof Response) return error;
    captureApiError(error, "admin/invoices PATCH");
    return NextResponse.json(
      { error: { message: "Fatura islemi basarisiz.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const PATCH = withRateLimit(patchHandler, adminRateLimits.mutation);
