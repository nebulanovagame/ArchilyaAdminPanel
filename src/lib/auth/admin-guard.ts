import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin auth guard for AdminPanel local API routes.
 *
 * Verifies:
 * 1. Valid Supabase session exists
 * 2. Authenticated user has is_admin = true in profiles table
 *
 * Returns the admin user ID on success, or a NextResponse error on failure.
 * Route handlers MUST check for NextResponse return and short-circuit.
 */
export async function requireAdmin(): Promise<
  { uid: string; email: string | null } | NextResponse
> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: { message: "Oturum gereklidir.", code: "unauthenticated" } },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_admin) {
      return NextResponse.json(
        { error: { message: "Admin yetkisi gereklidir.", code: "permission-denied" } },
        { status: 403 },
      );
    }

    return { uid: user.id, email: user.email ?? null };
  } catch (err) {
    console.error("[admin-guard] requireAdmin error:", err);
    return NextResponse.json(
      { error: { message: "Yetkilendirme hatasi.", code: "internal" } },
      { status: 500 },
    );
  }
}
