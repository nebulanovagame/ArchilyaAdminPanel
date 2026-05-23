"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { collection, doc, getDoc, getDocs, query, where, type QuerySnapshot, type Timestamp } from "firebase/firestore";

import { useAuth } from "@/components/providers/auth-provider";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { createActivityLogEntry } from "@/lib/activity/service";
import type { ActivityAction, ActivityCategory } from "@/lib/activity/types";
import type { WorkspaceBranding } from "@/lib/branding/types";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import {
  acceptWorkspaceInviteSecure,
  adjustWorkspaceStorageSecure,
  createWorkspaceSecure,
  deductWorkspacePoolCreditsSecure,
  declineWorkspaceInviteSecure,
  deleteWorkspaceSecure,
  inviteWorkspaceMemberSecure,
  removeWorkspaceMemberSecure,
  refundWorkspacePoolCreditsSecure,
} from "@/services/entitlement-service";

export type WorkspacePlan = "pro" | "studio" | "enterprise";

export type WorkspaceMember = {
  uid: string;
  email: string;
  displayName: string;
  role: "owner" | "admin" | "editor" | "viewer";
  joinedAt?: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  adminUid: string;
  adminEmail: string;
  plan: WorkspacePlan;
  branding?: WorkspaceBranding;
  memberUids: string[];
  members: WorkspaceMember[];
  poolCredits: number;
  poolStorage: number;
  usedStorage: number;
  subscriptionStatus: string;
  subscriptionPlanId: string;
  subscriptionStartAt: string | null;
  subscriptionEndAt: string | null;
  subscriptionAutoRenew: boolean;
  subscriptionCancelledAt: string | null;
  subscriptionPendingPlanId: string;
};

export type WorkspaceInvite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  fromUid?: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toUid?: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt?: string;
};

const WORKSPACE_PLAN_CONFIG: Record<WorkspacePlan, { maxMembers: number; poolCredits: number; poolStorage: number }> = {
  pro: {
    maxMembers: 5,
    poolCredits: 2200,
    poolStorage: 100 * 1024 * 1024 * 1024,
  },
  studio: {
    maxMembers: 20,
    poolCredits: 7000,
    poolStorage: 750 * 1024 * 1024 * 1024,
  },
  enterprise: {
    maxMembers: 20,
    poolCredits: 7000,
    poolStorage: 750 * 1024 * 1024 * 1024,
  },
};

function normalizeEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

function getWorkspacePlanConfig(plan: string | null | undefined) {
  const normalizedPlan = String(plan || "").trim().toLowerCase() as WorkspacePlan;
  return WORKSPACE_PLAN_CONFIG[normalizedPlan] || null;
}

function toDateString(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    const parsed = (value as Timestamp).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function mapWorkspaceDocument(id: string, data: Record<string, unknown>): WorkspaceRecord {
  const branding = data.branding && typeof data.branding === "object" && !Array.isArray(data.branding)
    ? (data.branding as WorkspaceBranding)
    : undefined;

  return {
    id,
    name: String(data.name || ""),
    adminUid: String(data.adminUid || ""),
    adminEmail: String(data.adminEmail || ""),
    plan: (String(data.plan || "pro").toLowerCase() as WorkspacePlan) || "pro",
    branding,
    memberUids: Array.isArray(data.memberUids) ? data.memberUids.map(String) : [],
    members: Array.isArray(data.members)
      ? data.members.map((member) => {
          const memberRecord = (member ?? {}) as Record<string, unknown>;
          return {
            uid: String(memberRecord.uid || ""),
            email: String(memberRecord.email || ""),
            displayName: String(memberRecord.displayName || memberRecord.email || ""),
            role: (() => {
              const r = String(memberRecord.role || "member").toLowerCase();
              if (r === "owner") return "owner";
              if (r === "admin") return "admin";
              if (r === "viewer") return "viewer";
              return "editor";
            })(),
            joinedAt: typeof memberRecord.joinedAt === "string" ? memberRecord.joinedAt : undefined,
          } satisfies WorkspaceMember;
        })
      : [],
    poolCredits: typeof data.poolCredits === "number" ? data.poolCredits : 0,
    poolStorage: typeof data.poolStorage === "number" ? data.poolStorage : 0,
    usedStorage: typeof data.usedStorage === "number" ? data.usedStorage : 0,
    subscriptionStatus: String(data.subscriptionStatus || "inactive"),
    subscriptionPlanId: String(data.subscriptionPlanId || ""),
    subscriptionStartAt: toDateString(data.subscriptionStartAt),
    subscriptionEndAt: toDateString(data.subscriptionEndAt),
    subscriptionAutoRenew: toBoolean(data.subscriptionAutoRenew, false),
    subscriptionCancelledAt: toDateString(data.subscriptionCancelledAt),
    subscriptionPendingPlanId: String(data.subscriptionPendingPlanId || ""),
  };
}

type WorkspaceContextValue = {
  adminWorkspace: WorkspaceRecord | null;
  memberWorkspace: WorkspaceRecord | null;
  activeWorkspace: WorkspaceRecord | null;
  workspaceInvites: WorkspaceInvite[];
  isAdmin: boolean;
  loading: boolean;
  MAX_MEMBERS: number;
  STUDIO_POOL_CREDITS: number;
  STUDIO_POOL_STORAGE: number;
  createWorkspace: (name?: string) => Promise<{ id: string }>;
  inviteMember: (toEmail: string) => Promise<unknown>;
  acceptWorkspaceInvite: (invite: WorkspaceInvite) => Promise<void>;
  declineWorkspaceInvite: (inviteId: string) => Promise<void>;
  removeMember: (memberUid: string) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  updatePoolStorage: (bytesDelta: number) => Promise<void>;
  deductPoolCredits: (amount: number) => Promise<void>;
  refundPoolCredits: (amount: number) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const { currentUser } = useAuth();
  const db = getFirebaseFirestore();

  const adminQuery = useMemo(
    () => (currentUser ? query(collection(db, "workspaces"), where("adminUid", "==", currentUser.uid)) : null),
    [currentUser, db],
  );
  const memberQuery = useMemo(
    () => (currentUser ? query(collection(db, "workspaces"), where("memberUids", "array-contains", currentUser.uid)) : null),
    [currentUser, db],
  );
  const inviteQuery = useMemo(
    () => (currentUser
      ? query(
          collection(db, "workspaceInvites"),
          where("toEmail", "==", normalizeEmail(currentUser.email)),
          where("status", "==", "pending"),
        )
      : null),
    [currentUser, db],
  );

  const mapAdminSnapshot = useCallback((snapshot: QuerySnapshot) => {
    return snapshot.empty ? null : mapWorkspaceDocument(snapshot.docs[0].id, snapshot.docs[0].data());
  }, []);

  const mapMemberSnapshot = useCallback((snapshot: QuerySnapshot) => {
    if (!currentUser) return null;
    const nonAdminWorkspace = snapshot.docs.find((docSnap) => docSnap.data().adminUid !== currentUser.uid);
    return nonAdminWorkspace ? mapWorkspaceDocument(nonAdminWorkspace.id, nonAdminWorkspace.data()) : null;
  }, [currentUser]);

  const mapInviteSnapshot = useCallback((snapshot: QuerySnapshot) => {
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        workspaceId: String(data.workspaceId || ""),
        workspaceName: String(data.workspaceName || "Workspace"),
        fromUid: typeof data.fromUid === "string" ? data.fromUid : undefined,
        fromEmail: String(data.fromEmail || ""),
        fromName: typeof data.fromName === "string" ? data.fromName : undefined,
        toEmail: String(data.toEmail || ""),
        toUid: typeof data.toUid === "string" ? data.toUid : null,
        status: String(data.status || "pending") === "accepted"
          ? "accepted"
          : String(data.status || "pending") === "declined"
            ? "declined"
            : "pending",
        createdAt: typeof data.createdAt?.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === "string"
            ? data.createdAt
            : undefined,
      } satisfies WorkspaceInvite;
    });
  }, []);

  const { data: adminWorkspace, loading: adminLoading } = useFirestoreQuery({
    queryRef: adminQuery,
    initialData: null as WorkspaceRecord | null,
    mapSnapshot: mapAdminSnapshot,
  });
  const { data: memberWorkspace, loading: memberLoading } = useFirestoreQuery({
    queryRef: memberQuery,
    initialData: null as WorkspaceRecord | null,
    mapSnapshot: mapMemberSnapshot,
  });
  const { data: workspaceInvites, loading: inviteLoading } = useFirestoreQuery({
    queryRef: inviteQuery,
    initialData: [] as WorkspaceInvite[],
    mapSnapshot: mapInviteSnapshot,
  });

  const loading = currentUser ? adminLoading || memberLoading || inviteLoading : false;

  const activeWorkspace = adminWorkspace || memberWorkspace;
  const isAdmin = adminWorkspace !== null;
  const activeWorkspacePlanConfig = getWorkspacePlanConfig(activeWorkspace?.plan);
  const MAX_MEMBERS = activeWorkspacePlanConfig?.maxMembers || 0;
  const STUDIO_POOL_CREDITS = activeWorkspacePlanConfig?.poolCredits || 0;
  const STUDIO_POOL_STORAGE = activeWorkspacePlanConfig?.poolStorage || 0;

  const logActivity = useCallback(async (
    workspaceId: string | undefined,
    category: ActivityCategory,
    action: ActivityAction,
    targetType: string,
    targetId: string,
    targetName: string,
    metadata: Record<string, unknown> = {},
  ) => {
    if (!currentUser || !workspaceId) return;
    try {
      await createActivityLogEntry(getFirebaseFirestore(), {
        workspaceId,
        category,
        action,
        actorUid: currentUser.uid,
        actorEmail: currentUser.email || "",
        actorName: currentUser.displayName || currentUser.email || t("common.user"),
        targetType,
        targetId,
        targetName,
        metadata,
        timestamp: null,
      });
    } catch {
      // Silently fail — audit logging must not break business logic
    }
  }, [currentUser, t]);

  const createWorkspace = useCallback(async (name?: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (adminWorkspace || memberWorkspace) {
      throw new Error(t("dashboard.team.errors.alreadyInWorkspace"));
    }

    const db = getFirebaseFirestore();
    const existingMembershipSnap = await getDocs(query(collection(db, "workspaces"), where("memberUids", "array-contains", currentUser.uid)));
    if (!existingMembershipSnap.empty) {
      throw new Error(t("dashboard.team.errors.alreadyInWorkspaceShort"));
    }

    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (!userSnap.exists()) {
      throw new Error(t("dashboard.team.errors.profileMissing"));
    }

    const userPlan = String(userSnap.data().plan || "free").toLowerCase();
    if (!["pro", "studio", "enterprise"].includes(userPlan)) {
      throw new Error(t("dashboard.team.errors.planRequired"));
    }

    const result = await createWorkspaceSecure(
      name || `${currentUser.displayName || currentUser.email || t("common.user")}'in ${t("dashboard.team.workspace")}`,
      currentUser.displayName || currentUser.email || t("common.user"),
      currentUser.email,
    );

    if (!result?.success) {
      throw new Error(t("dashboard.team.workspaceCreateFailed"));
    }

    void logActivity(result.workspaceId, "workspace", "createWorkspace", "workspace", result.workspaceId, name || t("dashboard.team.createWorkspace"), { plan: userPlan });

    return { id: result.workspaceId };
  }, [adminWorkspace, currentUser, logActivity, memberWorkspace, t]);

  const inviteMember = useCallback(async (toEmail: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (!adminWorkspace) throw new Error(t("dashboard.team.errors.adminRequired"));

    const targetEmail = normalizeEmail(toEmail);
    const currentEmail = normalizeEmail(currentUser.email);

    if (!targetEmail) throw new Error(t("dashboard.team.errors.validEmailRequired"));
    if (targetEmail === currentEmail) throw new Error(t("dashboard.team.errors.selfInvite"));

    const result = await inviteWorkspaceMemberSecure(adminWorkspace.id, targetEmail);
    if (!result?.success) {
      throw new Error(t("dashboard.team.inviteFailed"));
    }

    void logActivity(adminWorkspace.id, "member", "inviteMember", "user", targetEmail, targetEmail, { inviteId: result.inviteId });

    return result;
  }, [adminWorkspace, currentUser, logActivity, t]);

  const acceptWorkspaceInvite = useCallback(async (invite: WorkspaceInvite) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    const isPasswordUser = (currentUser.providerData || []).some((provider) => provider?.providerId === "password");
    if (isPasswordUser && !currentUser.emailVerified) {
      throw new Error(t("dashboard.team.errors.acceptEmailVerification"));
    }

    const result = await acceptWorkspaceInviteSecure(invite.id);
    if (!result?.success) {
      throw new Error(t("dashboard.team.acceptFailed"));
    }

    void logActivity(invite.workspaceId, "member", "acceptInvite", "user", currentUser.uid, currentUser.email || currentUser.displayName || t("common.user"), { inviteId: invite.id });
  }, [currentUser, logActivity, t]);

  const declineWorkspaceInvite = useCallback(async (inviteId: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));

    const result = await declineWorkspaceInviteSecure(inviteId);
    if (!result?.success) {
      throw new Error(t("dashboard.team.declineFailed"));
    }

    void logActivity(activeWorkspace?.id || "unknown", "member", "declineInvite", "invite", inviteId, inviteId, {});
  }, [activeWorkspace?.id, currentUser, logActivity, t]);

  const removeMember = useCallback(async (memberUid: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (!adminWorkspace) throw new Error(t("dashboard.team.errors.adminRequired"));
    if (memberUid === currentUser.uid) throw new Error(t("dashboard.team.errors.selfRemove"));

    const result = await removeWorkspaceMemberSecure(adminWorkspace.id, memberUid);
    if (!result?.success) {
      throw new Error(t("dashboard.team.errors.memberRemoveIncomplete"));
    }

    void logActivity(adminWorkspace.id, "member", "removeMember", "user", memberUid, memberUid, {});
  }, [adminWorkspace, currentUser, logActivity, t]);

  const deleteWorkspace = useCallback(async () => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (!adminWorkspace) throw new Error(t("dashboard.team.errors.adminRequired"));

    const result = await deleteWorkspaceSecure(adminWorkspace.id);
    if (!result?.success) {
      throw new Error(t("dashboard.team.workspaceDeleteFailed"));
    }

    void logActivity(adminWorkspace.id, "workspace", "deleteWorkspace", "workspace", adminWorkspace.id, adminWorkspace.name, {});
  }, [adminWorkspace, currentUser, logActivity, t]);

  const updatePoolStorage = useCallback(async (bytesDelta: number) => {
    if (!activeWorkspace || !bytesDelta) return;

    const result = await adjustWorkspaceStorageSecure(activeWorkspace.id, bytesDelta);
    if (!result?.success) {
      throw new Error(t("dashboard.team.errors.storageUpdateFailed"));
    }

    void logActivity(activeWorkspace.id, "file", bytesDelta > 0 ? "uploadFile" : "deleteFile", "workspace", activeWorkspace.id, activeWorkspace.name, { bytesDelta });
  }, [activeWorkspace, logActivity, t]);

  const deductPoolCredits = useCallback(async (amount: number) => {
    if (!activeWorkspace) {
      throw new Error(t("errors.activeWorkspaceMissing"));
    }

    await deductWorkspacePoolCreditsSecure(activeWorkspace.id, amount);

    void logActivity(activeWorkspace.id, "credit", "creditDeducted", "workspace", activeWorkspace.id, activeWorkspace.name, { amount });
  }, [activeWorkspace, logActivity, t]);

  const refundPoolCredits = useCallback(async (amount: number) => {
    if (!activeWorkspace) {
      throw new Error(t("errors.activeWorkspaceMissing"));
    }

    await refundWorkspacePoolCreditsSecure(activeWorkspace.id, amount);

    void logActivity(activeWorkspace.id, "credit", "creditRefunded", "workspace", activeWorkspace.id, activeWorkspace.name, { amount });
  }, [activeWorkspace, logActivity, t]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      adminWorkspace,
      memberWorkspace,
      activeWorkspace,
      workspaceInvites,
      isAdmin,
      loading,
      MAX_MEMBERS,
      STUDIO_POOL_CREDITS,
      STUDIO_POOL_STORAGE,
      createWorkspace,
      inviteMember,
      acceptWorkspaceInvite,
      declineWorkspaceInvite,
      removeMember,
      deleteWorkspace,
      updatePoolStorage,
      deductPoolCredits,
      refundPoolCredits,
    }),
    [
      adminWorkspace,
      memberWorkspace,
      activeWorkspace,
      workspaceInvites,
      isAdmin,
      loading,
      MAX_MEMBERS,
      STUDIO_POOL_CREDITS,
      STUDIO_POOL_STORAGE,
      createWorkspace,
      inviteMember,
      acceptWorkspaceInvite,
      declineWorkspaceInvite,
      removeMember,
      deleteWorkspace,
      updatePoolStorage,
      deductPoolCredits,
      refundPoolCredits,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within a WorkspaceProvider.");
  }
  return context;
}
