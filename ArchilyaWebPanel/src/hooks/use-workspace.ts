"use client";

import { useWorkspaceContext } from "@/components/providers/workspace-provider";

export type {
  WorkspacePlan,
  WorkspaceMember,
  WorkspaceRecord,
  WorkspaceInvite,
} from "@/components/providers/workspace-provider";

export function useWorkspace() {
  return useWorkspaceContext();
}
