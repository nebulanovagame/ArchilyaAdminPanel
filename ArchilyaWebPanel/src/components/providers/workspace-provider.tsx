"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/providers/auth-provider";
import { useRealtimeQuery } from "@/hooks/use-realtime-query";
import { createActivityLogEntry } from "@/lib/activity/service";
import type { ActivityAction, ActivityCategory } from "@/lib/activity/types";
import { mergeBrandingWithDefaults } from "@/lib/branding/defaults";
import type { WorkspaceBranding } from "@/lib/branding/types";
import { createClient } from "@/lib/supabase/client";
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

const WORKSPACE_SELECT = "id,name,admin_id,admin_uid,admin_email,plan,credits,used_storage,max_storage,branding_logo_url,branding_primary_color,branding_secondary_color,pool_credits,pool_storage";
const WORKSPACE_MEMBER_SELECT = "workspace_id,user_id,email,display_name,role,joined_at";
const WORKSPACE_INVITE_SELECT = "id,workspace_id,workspace_name,from_user_id,from_uid,from_email,from_name,to_user_id,to_uid,to_email,status,created_at";

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

  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readString(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  return String(data[camelKey] ?? data[snakeKey] ?? "");
}

function readNumber(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  return typeof value === "number" ? value : 0;
}

function readBoolean(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey, fallback = false) {
  return toBoolean(data[camelKey] ?? data[snakeKey], fallback);
}

function readStringArray(data: Record<string, unknown>, camelKey: string, snakeKey = camelKey) {
  const value = data[camelKey] ?? data[snakeKey];
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeMemberRow(member: Record<string, unknown>): WorkspaceMember {
  return {
    uid: readString(member, "uid", "user_id"),
    email: readString(member, "email"),
    displayName: readString(member, "displayName", "display_name") || readString(member, "email"),
    role: (() => {
      const r = readString(member, "role").toLowerCase();
      if (r === "owner") return "owner";
      if (r === "admin") return "admin";
      if (r === "viewer") return "viewer";
      return "editor";
    })(),
    joinedAt: readString(member, "joinedAt", "joined_at") || undefined,
  };
}

function mapWorkspaceDocument(id: string, data: Record<string, unknown>): WorkspaceRecord {
  const branding = data.branding && typeof data.branding === "object" && !Array.isArray(data.branding)
    ? (data.branding as WorkspaceBranding)
    : data.branding_logo_url || data.branding_primary_color || data.branding_secondary_color
      ? mergeBrandingWithDefaults({
          logoUrl: readString(data, "brandingLogoUrl", "branding_logo_url") || undefined,
          primaryColor: readString(data, "brandingPrimaryColor", "branding_primary_color") || undefined,
        })
      : undefined;

  return {
    id,
    name: String(data.name || ""),
    adminUid: readString(data, "adminUid", "admin_uid") || readString(data, "adminId", "admin_id"),
    adminEmail: readString(data, "adminEmail", "admin_email"),
    plan: (String(data.plan || "pro").toLowerCase() as WorkspacePlan) || "pro",
    branding,
    memberUids: readStringArray(data, "memberUids", "member_uids"),
    members: Array.isArray(data.members)
      ? data.members.map((member) => {
          const memberRecord = (member ?? {}) as Record<string, unknown>;
          return normalizeMemberRow(memberRecord);
        })
      : [],
    poolCredits: readNumber(data, "poolCredits", "pool_credits") || readNumber(data, "credits"),
    poolStorage: readNumber(data, "poolStorage", "pool_storage") || readNumber(data, "maxStorage", "max_storage"),
    usedStorage: readNumber(data, "usedStorage", "used_storage"),
    subscriptionStatus: readString(data, "subscriptionStatus", "subscription_status") || "inactive",
    subscriptionPlanId: readString(data, "subscriptionPlanId", "subscription_plan_id"),
    subscriptionStartAt: toDateString(data.subscriptionStartAt ?? data.subscription_start_at),
    subscriptionEndAt: toDateString(data.subscriptionEndAt ?? data.subscription_end_at),
    subscriptionAutoRenew: readBoolean(data, "subscriptionAutoRenew", "subscription_auto_renew", false),
    subscriptionCancelledAt: toDateString(data.subscriptionCancelledAt ?? data.subscription_cancelled_at),
    subscriptionPendingPlanId: readString(data, "subscriptionPendingPlanId", "subscription_pending_plan_id"),
  };
}

function mapInviteRow(row: Record<string, unknown>): WorkspaceInvite {
  const status = readString(row, "status") || "pending";

  return {
    id: readString(row, "id"),
    workspaceId: readString(row, "workspaceId", "workspace_id"),
    workspaceName: readString(row, "workspaceName", "workspace_name") || "Workspace",
    fromUid: readString(row, "fromUid", "from_uid") || readString(row, "fromUserId", "from_user_id") || undefined,
    fromEmail: readString(row, "fromEmail", "from_email"),
    fromName: readString(row, "fromName", "from_name") || undefined,
    toEmail: readString(row, "toEmail", "to_email"),
    toUid: readString(row, "toUid", "to_uid") || readString(row, "toUserId", "to_user_id") || null,
    status: status === "accepted" ? "accepted" : status === "declined" ? "declined" : "pending",
    createdAt: toDateString(row.createdAt ?? row.created_at) ?? undefined,
  };
}

async function fetchWorkspaceMembers(workspaceId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select(WORKSPACE_MEMBER_SELECT)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeMemberRow(row as Record<string, unknown>));
}

async function attachWorkspaceMembers(row: Record<string, unknown>) {
  const id = String(row.id || "");
  const members = id ? await fetchWorkspaceMembers(id) : [];
  return mapWorkspaceDocument(id, { ...row, members, member_uids: members.map((member) => member.uid) });
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

  const fetchAdminWorkspace = useCallback(async () => {
    if (!currentUser) return { data: null as WorkspaceRecord | null, error: null };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select(WORKSPACE_SELECT)
      .eq("admin_uid", currentUser.uid)
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data ? await attachWorkspaceMembers(data as Record<string, unknown>) : null, error: null };
  }, [currentUser]);

  const fetchMemberWorkspace = useCallback(async () => {
    if (!currentUser) return { data: null as WorkspaceRecord | null, error: null };

    const supabase = createClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", currentUser.uid)
      .limit(5);

    if (membershipError) return { data: null, error: { message: membershipError.message } };

    const workspaceIds = (memberships ?? [])
      .map((membership) => String(membership.workspace_id || ""))
      .filter(Boolean);

    if (workspaceIds.length === 0) return { data: null, error: null };

    const { data: workspaces, error: workspaceError } = await supabase
      .from("workspaces")
      .select(WORKSPACE_SELECT)
      .in("id", workspaceIds);

    if (workspaceError) return { data: null, error: { message: workspaceError.message } };

    const nonAdminWorkspace = (workspaces ?? []).find((workspace) => {
      const row = workspace as Record<string, unknown>;
      return readString(row, "adminUid", "admin_uid") !== currentUser.uid && readString(row, "adminId", "admin_id") !== currentUser.uid;
    });

    return { data: nonAdminWorkspace ? await attachWorkspaceMembers(nonAdminWorkspace as Record<string, unknown>) : null, error: null };
  }, [currentUser]);

  const fetchWorkspaceInvites = useCallback(async () => {
    const email = normalizeEmail(currentUser?.email);
    if (!email) return { data: [] as WorkspaceInvite[], error: null };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("workspace_invites")
      .select(WORKSPACE_INVITE_SELECT)
      .eq("to_email", email)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) return { data: [] as WorkspaceInvite[], error: { message: error.message } };
    return { data: (data ?? []).map((row) => mapInviteRow(row as Record<string, unknown>)), error: null };
  }, [currentUser?.email]);

  const { data: adminWorkspace, loading: adminLoading } = useRealtimeQuery({
    queryKey: `workspace-admin-${currentUser?.uid || "none"}`,
    queryFn: fetchAdminWorkspace,
    initialData: null as WorkspaceRecord | null,
    enabled: Boolean(currentUser?.uid),
  });
  const { data: memberWorkspace, loading: memberLoading } = useRealtimeQuery({
    queryKey: `workspace-member-${currentUser?.uid || "none"}`,
    queryFn: fetchMemberWorkspace,
    initialData: null as WorkspaceRecord | null,
    enabled: Boolean(currentUser?.uid),
  });
  const { data: workspaceInvites, loading: inviteLoading } = useRealtimeQuery({
    queryKey: `workspace-invites-${normalizeEmail(currentUser?.email) || "none"}`,
    queryFn: fetchWorkspaceInvites,
    initialData: [] as WorkspaceInvite[],
    enabled: Boolean(currentUser?.email),
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
      await createActivityLogEntry(null, {
        workspaceId,
        category,
        action,
        actorUid: currentUser.uid,
        actorEmail: currentUser.email || "",
        actorName: currentUser.name || currentUser.email || t("common.user"),
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
      throw new Error(t("errors.workspaceAlreadyInWorkspace"));
    }

    const supabase = createClient();
    const { data: existingMemberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", currentUser.uid)
      .limit(1);
    if (membershipError) {
      throw new Error(membershipError.message);
    }
    if ((existingMemberships ?? []).length > 0) {
      throw new Error(t("errors.workspaceAlreadyInWorkspaceShort"));
    }

    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("id", currentUser.uid)
      .maybeSingle();
    if (userError) {
      throw new Error(userError.message);
    }
    if (!userProfile) {
      throw new Error(t("errors.profileMissing"));
    }

    const userPlan = String(userProfile.subscription_plan || "free").toLowerCase();
    if (!["pro", "studio", "enterprise"].includes(userPlan)) {
      throw new Error(t("errors.workspacePlanRequired"));
    }

    const result = await createWorkspaceSecure(
      name || `${currentUser.name || currentUser.email || t("common.user")}'in ${t("common.workspace")}`,
      currentUser.name || currentUser.email || t("common.user"),
      currentUser.email,
    );

    if (!result?.success) {
      throw new Error(t("errors.workspaceCreateFailed"));
    }

    void logActivity(result.workspaceId, "workspace", "createWorkspace", "workspace", result.workspaceId, name || t("common.workspace"), { plan: userPlan });

    return { id: result.workspaceId };
  }, [adminWorkspace, currentUser, logActivity, memberWorkspace, t]);

  const inviteMember = useCallback(async (toEmail: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (!adminWorkspace) throw new Error(t("errors.workspaceAdminRequired"));

    const targetEmail = normalizeEmail(toEmail);
    const currentEmail = normalizeEmail(currentUser.email);

    if (!targetEmail) throw new Error(t("errors.validEmailRequired"));
    if (targetEmail === currentEmail) throw new Error(t("errors.selfInvite"));

    const result = await inviteWorkspaceMemberSecure(adminWorkspace.id, targetEmail);
    if (!result?.success) {
      throw new Error(t("errors.workspaceInviteFailed"));
    }

    void logActivity(adminWorkspace.id, "member", "inviteMember", "user", targetEmail, targetEmail, { inviteId: result.inviteId });

    return result;
  }, [adminWorkspace, currentUser, logActivity, t]);

  const acceptWorkspaceInvite = useCallback(async (invite: WorkspaceInvite) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    const isPasswordUser = (currentUser.providerData || []).some((provider) => provider?.providerId === "password");
    if (isPasswordUser && !currentUser.emailVerified) {
      throw new Error(t("errors.workspaceInviteEmailVerification"));
    }

    const result = await acceptWorkspaceInviteSecure(invite.id);
    if (!result?.success) {
      throw new Error(t("errors.workspaceInviteAcceptFailed"));
    }

    void logActivity(invite.workspaceId, "member", "acceptInvite", "user", currentUser.uid, currentUser.email || currentUser.name || t("common.user"), { inviteId: invite.id });
  }, [currentUser, logActivity, t]);

  const declineWorkspaceInvite = useCallback(async (inviteId: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));

    const result = await declineWorkspaceInviteSecure(inviteId);
    if (!result?.success) {
      throw new Error(t("errors.workspaceInviteDeclineFailed"));
    }

    void logActivity(activeWorkspace?.id || "unknown", "member", "declineInvite", "invite", inviteId, inviteId, {});
  }, [activeWorkspace?.id, currentUser, logActivity, t]);

  const removeMember = useCallback(async (memberUid: string) => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (!adminWorkspace) throw new Error(t("errors.workspaceAdminRequired"));
    if (memberUid === currentUser.uid) throw new Error(t("errors.selfRemove"));

    const result = await removeWorkspaceMemberSecure(adminWorkspace.id, memberUid);
    if (!result?.success) {
      throw new Error(t("errors.memberRemoveIncomplete"));
    }

    void logActivity(adminWorkspace.id, "member", "removeMember", "user", memberUid, memberUid, {});
  }, [adminWorkspace, currentUser, logActivity, t]);

  const deleteWorkspace = useCallback(async () => {
    if (!currentUser) throw new Error(t("errors.sessionRequired"));
    if (!adminWorkspace) throw new Error(t("errors.workspaceAdminRequired"));

    const result = await deleteWorkspaceSecure(adminWorkspace.id);
    if (!result?.success) {
      throw new Error(t("errors.workspaceDeleteFailed"));
    }

    void logActivity(adminWorkspace.id, "workspace", "deleteWorkspace", "workspace", adminWorkspace.id, adminWorkspace.name, {});
  }, [adminWorkspace, currentUser, logActivity, t]);

  const updatePoolStorage = useCallback(async (bytesDelta: number) => {
    if (!activeWorkspace || !bytesDelta) return;

    const result = await adjustWorkspaceStorageSecure(activeWorkspace.id, bytesDelta);
    if (!result?.success) {
      throw new Error(t("errors.storageUpdateFailed"));
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
