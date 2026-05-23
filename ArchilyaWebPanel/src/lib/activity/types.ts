import type { Timestamp } from "firebase/firestore";

export type ActivityCategory = "member" | "project" | "credit" | "ai" | "subscription" | "file" | "workspace";

export type ActivityAction =
  | "createWorkspace"
  | "inviteMember"
  | "acceptInvite"
  | "declineInvite"
  | "removeMember"
  | "deleteWorkspace"
  | "createProject"
  | "softDeleteProject"
  | "restoreProject"
  | "hardDeleteProject"
  | "uploadFile"
  | "deleteFile"
  | "restoreFile"
  | "permanentlyDeleteFile"
  | "aiJobQueued"
  | "aiJobCompleted"
  | "aiJobFailed"
  | "creditDeducted"
  | "creditRefunded"
  | "subscriptionUpgraded"
  | "subscriptionDowngraded"
  | "subscriptionCancelled"
  | "subscriptionReactivated";

export type ActivityLogRecord = {
  id: string;
  workspaceId: string;
  action: ActivityAction;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  targetType: string;
  targetId: string;
  targetName: string;
  metadata: Record<string, unknown>;
  timestamp: Date | Timestamp | string | null;
  category: ActivityCategory;
};

export type ActivityLogQueryOptions = {
  workspaceId: string;
  category?: ActivityCategory;
  action?: ActivityAction;
  actorUid?: string;
  fromDate?: Date | Timestamp | string | null;
  toDate?: Date | Timestamp | string | null;
  pageSize?: number;
  cursor?: unknown;
};
