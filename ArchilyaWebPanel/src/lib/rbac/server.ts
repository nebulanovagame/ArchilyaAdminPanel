import { doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import type { WorkspaceRole, Permission } from "@/lib/rbac/permissions";
import { hasPermission, hasMinimumRole } from "@/lib/rbac/permissions";

export async function getUserWorkspaceRole(
  uid: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const db = getFirebaseFirestore();
  const workspaceSnap = await getDoc(doc(db, "workspaces", workspaceId));

  if (!workspaceSnap.exists()) {
    return null;
  }

  const data = workspaceSnap.data();

  if (data.adminUid === uid) {
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
