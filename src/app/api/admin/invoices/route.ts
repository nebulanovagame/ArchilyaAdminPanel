import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";

export async function GET(request: Request) {
  try {
    await requireAdmin();

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Faturalar yuklenemedi." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const action = formData.get("action") as string;
    const idsJson = formData.get("ids") as string;

    if (!idsJson) {
      return NextResponse.json({ error: "ids parametresi gerekli." }, { status: 400 });
    }

    const ids = JSON.parse(idsJson) as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "En az bir odeme secmelisiniz." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    if (action === "mark_invoiced") {
      const invoiceFile = formData.get("invoice") as File | null;
      let invoiceUrl: string | null = null;

      if (invoiceFile && invoiceFile.size > 0) {
        if (invoiceFile.type !== "application/pdf") {
          return NextResponse.json({ error: "Sadece PDF dosyasi yuklenebilir." }, { status: 400 });
        }
        if (invoiceFile.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "PDF dosyasi 5MB'dan kucuk olmalidir." }, { status: 400 });
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
          return NextResponse.json({ error: `PDF yuklenemedi: ${uploadError.message}` }, { status: 500 });
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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (invoiceUrl) {
        const { data: session } = await supabase
          .from("payment_sessions")
          .select("user_email, user_name, amount, type, plan_id, package_id, credit_amount, currency")
          .eq("id", ids[0])
          .single();

        if (session?.user_email) {
          const s = session as { user_email: string; user_name?: string; amount: number; type: string; plan_id?: string; package_id?: string; credit_amount?: number; currency?: string };
          void fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/call/sendInvoiceEmail`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.INTERNAL_PROCESS_SECRET || ""}`,
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
          }).catch((e) => console.error("[invoice] email send error:", e));
        }
      }

      return NextResponse.json({ success: true, invoice_url: invoiceUrl });
    }

    if (action === "unmark_invoiced") {
      const { error } = await supabase
        .from("payment_sessions")
        .update({ invoiced_at: null, invoice_url: null })
        .in("id", ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Gecersiz aksiyon." }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Fatura islemi basarisiz." }, { status: 500 });
  }
}
