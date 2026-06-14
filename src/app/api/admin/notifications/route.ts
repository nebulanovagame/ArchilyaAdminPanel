import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";

export async function POST(_request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    let body: {
      title?: string;
      body?: string;
      type?: string;
      targetUserIds?: string[];
    };
    try {
      body = await _request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Gecersiz JSON", code: "invalid-body" } },
        { status: 400 },
      );
    }

    const title = (body.title || "").trim();
    const bodyText = (body.body || "").trim();
    const type = (body.type || "broadcast").trim();
    const targetUserIds = Array.isArray(body.targetUserIds)
      ? body.targetUserIds.filter(Boolean)
      : null;

    if (!title || !bodyText) {
      return NextResponse.json(
        { error: { message: "title ve body alanlari zorunludur", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Get admin info for logging
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();

    let userIds = targetUserIds;

    // If no specific targets → send to ALL users
    if (!userIds || userIds.length === 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id");

      if (profileError) {
        return NextResponse.json(
          { error: { message: "Kullanicilar alinamadi", code: "internal" } },
          { status: 500 },
        );
      }

      userIds = (profiles || []).map((p) => p.id);
    }

    if (userIds.length === 0) {
      return NextResponse.json({
        data: { success: true, sentCount: 0, message: "Hedef kullanici bulunamadi." },
      });
    }

    // Build notification rows
    const rows = userIds.map((uid) => ({
      user_id: uid,
      type,
      title,
      body: bodyText,
      data: {
        sentBy: adminUser?.id || "unknown",
        sentByEmail: adminUser?.email || "unknown",
      },
    }));

    // Batch insert in chunks of 500
    const CHUNK_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { data: inserted, error: insertError } = await supabase
        .from("notifications")
        .insert(chunk)
        .select("id");

      if (insertError) throw insertError;
      if (inserted) insertedCount += inserted.length;
    }

    // Log activity
    try {
      await supabase.from("workspace_activity_logs").insert({
        actor_id: adminUser?.id || "unknown",
        action: "send_notification",
        resource: "notifications",
        resource_id: "broadcast",
        details: JSON.stringify({
          type,
          title,
          targetCount: userIds.length,
          hasSpecificTargets: !!targetUserIds,
        }),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      data: {
        success: true,
        sentCount: rows.length,
        insertedCount,
      },
    });
  } catch (err) {
    console.error("Admin API /notifications error:", err);
    return NextResponse.json(
      { error: { message: "Bildirim gonderilirken hata olustu", code: "internal" } },
      { status: 500 },
    );
  }
}
