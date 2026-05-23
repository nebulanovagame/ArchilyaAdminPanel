"use client";

import { useMemo } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/hooks/use-workspace";
import type { WorkspaceRole } from "@/lib/rbac/permissions";

export function useWorkspaceRole() {
  const { currentUser } = useAuth();
  const { activeWorkspace, adminWorkspace } = useWorkspace();

  const role = useMemo<WorkspaceRole>(() => {
    if (!currentUser || !activeWorkspace) return "viewer";

    if (adminWorkspace?.id === activeWorkspace.id) {
      return "owner";
    }

    const member = activeWorkspace.members.find((m) => m.uid === currentUser.uid);
    const normalizedRole = String(member?.role || "").toLowerCase();

    if (normalizedRole === "admin") return "admin";
    if (normalizedRole === "editor") return "editor";
    if (normalizedRole === "viewer") return "viewer";

    return "viewer";
  }, [currentUser, activeWorkspace, adminWorkspace]);

  const isOwner = role === "owner";
  const isAdmin = role === "owner" || role === "admin";
  const isEditor = role === "owner" || role === "admin" || role === "editor";
  const isViewer = true;

  return {
    role,
    isOwner,
    isAdmin,
    isEditor,
    isViewer,
  };
}
