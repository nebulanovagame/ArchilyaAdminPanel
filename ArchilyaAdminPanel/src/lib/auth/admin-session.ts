import "server-only";

/**
 * Server-side admin session utilities.
 *
 * ⚠️ IMPORTANT SECURITY NOTES:
 * - This module runs ONLY on the server (via "server-only" import).
 * - Admin role verification MUST also be done on the backend API.
 * - The frontend check is for UI protection only, not security enforcement.
 * - In production, the backend Admin API must verify:
 *   1. JWT token validity (via Supabase auth.getUser)
 *   2. Admin role from profiles.role or admin_users table
 *   3. Audit logging for all admin actions
 *   4. Rate limiting
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AdminUser } from "@/lib/api/types";

export type AdminSessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

function toAdminSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
}): AdminSessionUser {
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: user.user_metadata?.name ?? null,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };
}

export async function getOptionalAdminSession(): Promise<AdminSessionUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    return toAdminSessionUser(user);
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSessionUser> {
  const sessionUser = await getOptionalAdminSession();

  if (!sessionUser) {
    redirect("/giris");
  }

  return sessionUser;
}
