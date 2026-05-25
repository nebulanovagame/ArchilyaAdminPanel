import { createClient } from "@/lib/supabase/client";
import type { WorkspaceRole, Permission } from "@/lib/rbac/permissions";
import { hasPermission, hasMinimumRole } from "@/lib/rbac/permissions";

export async function getUserWorkspaceRole(
  uid: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("admin_uid, members")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    return null;
  }

  if (data.admin_uid === uid) {
    return "owner";
  }

  const members = Array.isArray(data.members) ? data.members : [];
  const member = members.find(
    (m: { uid?: string; role?: string }) => m.uid === uid,
  );

  if (
    member?.role &&
    ["owner", "admin", "editor", "viewer"].includes(member.role)
  ) {
    return member.role as WorkspaceRole;
  }

  return null;
}

export async function requireWorkspacePermission(
  uid: string,
  workspaceId: string,
  permission: Permission,
): Promise<WorkspaceRole> {
  const role = await getUserWorkspaceRole(uid, workspaceId);

  if (!role) {
    throw new Error("Bu işlem için çalışma alanı erişim yetkisi gereklidir.");
  }

  if (!hasPermission(role, permission)) {
    throw new Error("Bu işlem için yeterli yetkiniz bulunmamaktadır.");
  }

  return role;
}

export async function requireWorkspaceMinimumRole(
  uid: string,
  workspaceId: string,
  requiredRole: WorkspaceRole,
): Promise<WorkspaceRole> {
  const role = await getUserWorkspaceRole(uid, workspaceId);

  if (!role) {
    throw new Error("Bu işlem için çalışma alanı erişim yetkisi gereklidir.");
  }

  if (!hasMinimumRole(role, requiredRole)) {
    throw new Error("Bu işlem için yeterli yetkiniz bulunmamaktadır.");
  }

  return role;
}
