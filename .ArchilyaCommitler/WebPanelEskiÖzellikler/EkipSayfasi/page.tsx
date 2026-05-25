"use client";

import { createElement, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Users, Crown, UserPlus, UserMinus, Mail, Check, X,
  Loader2, ShieldCheck, Sparkles, HardDrive, AlertCircle,
  Building2, ChevronRight, Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useCredits } from "@/hooks/use-credits";
import { useWorkspace, type WorkspaceInvite } from "@/hooks/use-workspace";
import { useWorkspaceRole } from "@/hooks/use-workspace-role";
import { useWorkspaceActivity } from "@/hooks/use-workspace-activity";

function formatBytes(bytes: number) {
  if (!bytes) return "0 GB";
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(0)} GB`;
}

function timeAgo(dateStr: string | undefined, t: ReturnType<typeof useTranslations>) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return t("dashboard.team.justNow");
  if (diff < 3600) return t("dashboard.team.minutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 86400) return t("dashboard.team.hoursAgoShort", { count: Math.floor(diff / 3600) });
  return t("dashboard.team.daysAgo", { count: Math.floor(diff / 86400) });
}

function getWorkspacePlanPreset(plan: string, t: ReturnType<typeof useTranslations>) {
  const normalizedPlan = String(plan || "").trim().toLowerCase();

  if (normalizedPlan === "pro") {
    return {
      isEligible: true,
      label: "Pro",
      maxMembers: 5,
      poolCredits: t("dashboard.team.poolCreditsPro"),
      storage: t("dashboard.team.storagePro"),
      cta: t("dashboard.team.proWorkspaceCta"),
      teaser: [
        { icon: Users, label: t("dashboard.team.teamMembers5"), color: "text-amber-400" },
        { icon: Sparkles, label: t("dashboard.team.quotaPool2200"), color: "text-primary" },
        { icon: HardDrive, label: t("dashboard.team.storage100"), color: "text-emerald-400" },
      ],
    };
  }

  if (normalizedPlan === "studio" || normalizedPlan === "enterprise") {
    return {
      isEligible: true,
      label: "Studio",
      maxMembers: 20,
      poolCredits: t("dashboard.team.poolCreditsStudio"),
      storage: t("dashboard.team.storageStudio"),
      cta: t("dashboard.team.studioWorkspaceCta"),
      teaser: [
        { icon: Users, label: t("dashboard.team.teamMembers20"), color: "text-amber-400" },
        { icon: Sparkles, label: t("dashboard.team.quotaPool7000"), color: "text-primary" },
        { icon: HardDrive, label: t("dashboard.team.storage750"), color: "text-emerald-400" },
      ],
    };
  }

  return {
    isEligible: false,
    label: "Pro",
    maxMembers: 5,
    poolCredits: t("dashboard.team.poolCreditsPro"),
    storage: t("dashboard.team.storagePro"),
    cta: t("dashboard.team.upgradeToPro"),
    teaser: [
      { icon: Users, label: t("dashboard.team.teamMembers5"), color: "text-amber-400" },
      { icon: Sparkles, label: t("dashboard.team.quotaPool2200"), color: "text-primary" },
      { icon: HardDrive, label: t("dashboard.team.storage100"), color: "text-emerald-400" },
    ],
  };
}

const ACTIVITY_ACTION_TRANSLATION_KEYS: Record<string, string> = {
  createWorkspace: "dashboard.team.activityActions.createWorkspace",
  inviteMember: "dashboard.team.activityActions.inviteMember",
  acceptInvite: "dashboard.team.activityActions.acceptInvite",
  declineInvite: "dashboard.team.activityActions.declineInvite",
  removeMember: "dashboard.team.activityActions.removeMember",
  deleteWorkspace: "dashboard.team.activityActions.deleteWorkspace",
  createProject: "dashboard.team.activityActions.createProject",
  softDeleteProject: "dashboard.team.activityActions.softDeleteProject",
  restoreProject: "dashboard.team.activityActions.restoreProject",
  hardDeleteProject: "dashboard.team.activityActions.hardDeleteProject",
  uploadFile: "dashboard.team.activityActions.uploadFile",
  deleteFile: "dashboard.team.activityActions.deleteFile",
  restoreFile: "dashboard.team.activityActions.restoreFile",
  permanentlyDeleteFile: "dashboard.team.activityActions.permanentlyDeleteFile",
  aiJobQueued: "dashboard.team.activityActions.aiJobQueued",
  aiJobCompleted: "dashboard.team.activityActions.aiJobCompleted",
  aiJobFailed: "dashboard.team.activityActions.aiJobFailed",
  creditDeducted: "dashboard.team.activityActions.creditDeducted",
  creditRefunded: "dashboard.team.activityActions.creditRefunded",
  subscriptionUpgraded: "dashboard.team.activityActions.subscriptionUpgraded",
  subscriptionDowngraded: "dashboard.team.activityActions.subscriptionDowngraded",
  subscriptionCancelled: "dashboard.team.activityActions.subscriptionCancelled",
  subscriptionReactivated: "dashboard.team.activityActions.subscriptionReactivated",
};

function NoWorkspaceView({
  plan,
  onCreateWorkspace,
  creating,
  onUpgrade,
}: {
  plan: string;
  onCreateWorkspace: () => Promise<void>;
  creating: boolean;
  onUpgrade: () => void;
}) {
  const t = useTranslations();
  const workspacePreset = getWorkspacePlanPreset(plan, t);

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 px-6 text-center max-w-lg mx-auto"
    >
      <div className="w-16 h-16 rounded-sm bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-6">
        <Building2 className="w-8 h-8 text-amber-400" />
      </div>

      <p className="text-amber-400 text-[10px] uppercase tracking-[0.3em] font-sans mb-2">{t("dashboard.team.workspace")}</p>
      <h2 className="text-3xl font-serif text-white italic mb-3">{t("dashboard.team.createWorkspace")}</h2>

      {workspacePreset.isEligible ? (
        <>
          <p className="text-gray-400 text-sm font-sans leading-relaxed mb-8">
            {t("dashboard.team.eligibleDescription", { plan: workspacePreset.label, credits: workspacePreset.poolCredits, storage: workspacePreset.storage })}
          </p>

          <button
            onClick={() => void onCreateWorkspace()}
            disabled={creating}
            className="flex items-center gap-2 bg-amber-400 text-black text-xs font-bold uppercase tracking-widest px-8 py-3.5 rounded-sm hover:bg-white transition-colors disabled:opacity-50"
          >
            {creating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("dashboard.team.creating")}</>
            ) : (
              <><Building2 className="w-4 h-4" /> {workspacePreset.cta}</>
            )}
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-400 text-sm font-sans leading-relaxed mb-8">
            {t("dashboard.team.upgradeDescription")}
          </p>

          <button
            onClick={onUpgrade}
            className="flex items-center gap-2 bg-amber-400 text-black text-xs font-bold uppercase tracking-widest px-8 py-3.5 rounded-sm hover:bg-white transition-colors"
          >
            <Crown className="w-4 h-4" /> {workspacePreset.cta}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      <div className="mt-8 grid grid-cols-3 gap-4 w-full">
        {workspacePreset.teaser.map(({ icon: TeaserIcon, label, color }) => (
          <div key={label} className="p-4 bg-white/3 border border-white/8 rounded-sm flex flex-col items-center gap-2">
            {createElement(TeaserIcon, { className: `w-5 h-5 ${color}` })}
            <span className="text-[10px] text-gray-500 font-sans text-center leading-snug">{label}</span>
          </div>
        ))}
      </div>
    </Motion.div>
  );
}

function InviteForm({ onInvite, currentCount, maxCount }: { onInvite: (email: string) => Promise<unknown>; currentCount: number; maxCount: number }) {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await onInvite(email.trim().toLowerCase());
      toast.success(t("dashboard.team.inviteSent", { email }));
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.team.inviteFailed"));
    } finally {
      setLoading(false);
    }
  }

  const isFull = currentCount >= maxCount;

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isFull ? t("dashboard.team.maxMembersReached") : "ortak@firma.com"}
          disabled={isFull || loading}
          className="w-full bg-white/5 border border-white/10 rounded-sm pl-10 pr-4 py-2.5 text-sm text-white font-sans placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-40"
        />
      </div>
      <button
        type="submit"
        disabled={isFull || loading || !email.trim()}
        className="flex items-center gap-2 bg-primary text-black text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-sm hover:bg-white transition-colors disabled:opacity-40"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
        {t("dashboard.team.invite")}
      </button>
    </form>
  );
}

export default function EkipPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const {
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
  } = useWorkspace();
  const { plan, loading: creditsLoading } = useCredits();
  const { role, isAdmin: isWorkspaceAdmin, isOwner } = useWorkspaceRole();
  const { logs: activityLogs, loading: activityLoading, hasMore: activityHasMore, loadMore: loadMoreActivity } = useWorkspaceActivity();

  const [creating, setCreating] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await createWorkspace();
      toast.success(t("dashboard.team.workspaceCreated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.team.workspaceCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(uid: string, email: string) {
    setRemovingUid(uid);
    try {
      await removeMember(uid);
      toast.success(t("dashboard.team.memberRemoved", { email }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.team.memberRemoveFailed"));
    } finally {
      setRemovingUid(null);
    }
  }

  async function handleAccept(invite: WorkspaceInvite) {
    setAcceptingId(invite.id);
    try {
      await acceptWorkspaceInvite(invite);
      toast.success(t("dashboard.team.joinedWorkspace", { workspaceName: invite.workspaceName }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.team.acceptFailed"));
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleDecline(inviteId: string) {
    setDecliningId(inviteId);
    try {
      await declineWorkspaceInvite(inviteId);
      toast(t("dashboard.team.inviteDeclined"), { icon: "✕" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.team.declineFailed"));
    } finally {
      setDecliningId(null);
    }
  }

  async function handleDeleteWorkspace() {
    setDeletingWorkspace(true);
    try {
      await deleteWorkspace();
      toast.success(t("dashboard.team.workspaceDeleted"));
      setConfirmDelete(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.team.workspaceDeleteFailed"));
    } finally {
      setDeletingWorkspace(false);
    }
  }

  if (loading || creditsLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  const members = activeWorkspace?.members || [];
  const memberCount = members.length;
  const poolCredits = activeWorkspace?.poolCredits ?? 0;
  const workspacePoolTotal = activeWorkspace?.poolStorage ?? STUDIO_POOL_STORAGE;
  const workspacePlanLabel = activeWorkspace?.plan === "pro" ? "Pro" : activeWorkspace?.plan ? "Studio" : getWorkspacePlanPreset(plan, t).label;
  const usedStorage = activeWorkspace?.usedStorage ?? 0;
  const creditPct = STUDIO_POOL_CREDITS ? Math.round((poolCredits / STUDIO_POOL_CREDITS) * 100) : 0;
  const storagePct = workspacePoolTotal ? Math.round((usedStorage / workspacePoolTotal) * 100) : 0;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-sm bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-amber-400 text-[10px] uppercase tracking-[0.3em]">{workspacePlanLabel}</p>
            <h1 className="text-3xl font-serif text-white italic">{t("dashboard.team.title")}</h1>
          </div>
        </div>
        <p className="text-gray-400 text-sm font-sans max-w-2xl mt-3">
          {t("dashboard.team.subtitle")}
        </p>
      </Motion.div>

      <AnimatePresence>
        {workspaceInvites.length > 0 && (
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 space-y-3"
          >
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-sans mb-2">{t("dashboard.team.pendingInvites")}</p>
            {workspaceInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-4 p-4 bg-amber-400/5 border border-amber-400/20 rounded-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-sans font-medium">{invite.workspaceName}</p>
                    <p className="text-[10px] text-gray-500 font-sans mt-0.5">{t("dashboard.team.invitedYou", { name: invite.fromName || invite.fromEmail, time: timeAgo(invite.createdAt, t) })}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => void handleAccept(invite)}
                    disabled={acceptingId === invite.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-400 text-black text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {acceptingId === invite.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} {t("dashboard.team.join")}
                  </button>
                  <button
                    onClick={() => void handleDecline(invite.id)}
                    disabled={decliningId === invite.id}
                    className="flex items-center gap-1 px-3 py-1.5 border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-400/20 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-colors disabled:opacity-50"
                  >
                    {decliningId === invite.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} {t("dashboard.team.decline")}
                  </button>
                </div>
              </div>
            ))}
          </Motion.div>
        )}
      </AnimatePresence>

      {!activeWorkspace ? (
        <NoWorkspaceView
          plan={plan}
          onCreateWorkspace={handleCreate}
          creating={creating}
          onUpgrade={() => router.push("/abonelik")}
        />
      ) : (
        <div className="space-y-6">
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="p-5 rounded-sm border bg-amber-400/5 border-amber-400/20">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-sans mb-3">{t("dashboard.team.teamMembers")}</p>
              <div className="flex items-end gap-2">
                <Users className="w-5 h-5 text-amber-400 mb-0.5" />
                <span className="text-2xl font-serif text-white">{memberCount}</span>
                <span className="text-gray-600 text-xs font-sans mb-0.5">/ {MAX_MEMBERS} {t("dashboard.team.memberCountUnit")}</span>
              </div>
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${MAX_MEMBERS ? (memberCount / MAX_MEMBERS) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="p-5 rounded-sm border bg-primary/5 border-primary/20">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-sans mb-3">{t("dashboard.team.poolQuota")}</p>
              <div className="flex items-end gap-2">
                <Sparkles className={`w-5 h-5 mb-0.5 ${poolCredits < 200 ? "text-red-400" : "text-primary"}`} />
                <span className={`text-2xl font-serif ${poolCredits < 200 ? "text-red-400" : "text-white"}`}>
                  {poolCredits.toLocaleString("tr-TR")}
                </span>
                <span className="text-gray-600 text-xs font-sans mb-0.5">/ {STUDIO_POOL_CREDITS.toLocaleString("tr-TR")}</span>
              </div>
              {poolCredits < 200 && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <p className="text-[10px] text-red-400 font-sans">{t("dashboard.team.quotaLow")}</p>
                </div>
              )}
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${poolCredits < 200 ? "bg-red-400" : "bg-primary"}`} style={{ width: `${Math.min(creditPct, 100)}%` }} />
              </div>
            </div>

            <div className="p-5 rounded-sm border bg-emerald-400/5 border-emerald-400/20">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-sans mb-3">{t("dashboard.team.poolStorage")}</p>
              <div className="flex items-end gap-2">
                <HardDrive className="w-5 h-5 text-emerald-400 mb-0.5" />
                <span className="text-2xl font-serif text-white">{formatBytes(usedStorage)}</span>
                <span className="text-gray-600 text-xs font-sans mb-0.5">/ {formatBytes(workspacePoolTotal)}</span>
              </div>
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(storagePct, 100)}%` }} />
              </div>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-[#0d0f13] border border-white/5 rounded-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-serif text-white italic">{activeWorkspace.name}</h2>
              <span className="text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider">{t("dashboard.team.workspaceBadge", { plan: workspacePlanLabel })}</span>
            </div>
            <p className="text-xs text-gray-500 font-sans">{t("dashboard.team.adminLabel")} <span className="text-gray-300">{activeWorkspace.adminEmail}</span></p>
          </Motion.div>

          {isWorkspaceAdmin && (
            <Motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="p-6 bg-[#0d0f13] border border-white/5 rounded-sm"
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-sans mb-4">{t("dashboard.team.inviteMembersTitle", { current: memberCount, max: MAX_MEMBERS })}</p>
              <InviteForm onInvite={inviteMember} currentCount={memberCount} maxCount={MAX_MEMBERS} />
              <p className="text-[10px] text-gray-700 font-sans mt-3">{t("dashboard.team.inviteHelp")}</p>
            </Motion.div>
          )}

          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[#0d0f13] border border-white/5 rounded-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("dashboard.team.workspaceMembers")}</p>
              <span className="text-[9px] text-gray-700 font-sans">{t("dashboard.team.membersCount", { current: memberCount, max: MAX_MEMBERS })}</span>
            </div>

            <div className="divide-y divide-white/5">
              {members.map((member) => {
                const isRemoving = removingUid === member.uid;
                return (
                  <div key={member.uid} className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${member.role === "admin" ? "bg-amber-400 text-black" : "bg-primary/20 text-primary"}`}>
                      {(member.displayName || member.email || "?")[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-sans font-medium truncate">{member.displayName || member.email}</p>
                        {member.role === "admin" && (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                            <Crown className="w-2.5 h-2.5" /> {t("common.admin")}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 font-sans truncate">{member.email}</p>
                      {member.joinedAt && <p className="text-[9px] text-gray-700 font-sans mt-0.5">{t("dashboard.team.joinedAt", { time: timeAgo(member.joinedAt, t) })}</p>}
                    </div>

                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ${member.role === "admin" ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" : "bg-primary/10 text-primary border border-primary/20"}`}>
                      {member.role === "admin" ? t("dashboard.team.ownerRole") : t("dashboard.team.memberRole")}
                    </span>

                    {isWorkspaceAdmin && member.role !== "admin" && (
                      <button
                        title={t("dashboard.team.removeMemberTitle")}
                        onClick={() => void handleRemove(member.uid, member.email)}
                        disabled={isRemoving}
                        className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-red-400 border border-transparent hover:border-red-400/20 px-2 py-1.5 rounded-sm transition-all disabled:opacity-50"
                      >
                        {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-3 p-4 bg-emerald-400/5 border border-emerald-400/15 rounded-sm"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              <span className="text-emerald-400 font-bold">{t("dashboard.team.securityTitle")}</span>{" "}
              {t("dashboard.team.securityBody")}
            </p>
          </Motion.div>

          {/* Activity Log */}
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-[#0d0f13] border border-white/5 rounded-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/5 bg-white/2 flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("dashboard.team.activityHistory")}</p>
              <span className="text-[9px] text-gray-700 font-sans">{t("dashboard.team.recordsCount", { count: activityLogs.length })}</span>
            </div>

            {activityLoading && activityLogs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-xs text-gray-600 font-sans">{t("dashboard.team.activityEmpty")}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activityLogs.map((log) => {
                  const date = log.timestamp
                    ? new Date(typeof log.timestamp === "object" && "toDate" in log.timestamp ? log.timestamp.toDate() : log.timestamp).toLocaleString(locale)
                    : t("dashboard.team.unknown");
                  const actionLabel = ACTIVITY_ACTION_TRANSLATION_KEYS[log.action]
                    ? t(ACTIVITY_ACTION_TRANSLATION_KEYS[log.action])
                    : log.action;
                  return (
                    <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-white/2 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary uppercase">{log.actorName[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-sans">
                          <span className="font-medium">{log.actorName}</span>{" "}
                          <span className="text-gray-400">{actionLabel}</span>
                          {log.targetName && log.targetName !== log.targetId && (
                            <span className="text-gray-500"> · {log.targetName}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-600 font-sans mt-0.5">{date}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        log.category === "member" ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                        log.category === "project" ? "bg-blue-400/10 text-blue-400 border-blue-400/20" :
                        log.category === "credit" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" :
                        log.category === "ai" ? "bg-purple-400/10 text-purple-400 border-purple-400/20" :
                        log.category === "subscription" ? "bg-primary/10 text-primary border-primary/20" :
                        "bg-white/5 text-gray-400 border-white/10"
                      }`}>
                        {log.category}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {activityHasMore && (
              <div className="flex justify-center py-4 border-t border-white/5">
                <button
                  onClick={() => void loadMoreActivity()}
                  disabled={activityLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:border-primary/40 hover:text-white transition-all disabled:opacity-50"
                >
                  {activityLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {t("dashboard.team.loadMore")}
                </button>
              </div>
            )}
          </Motion.div>

          {isOwner ? (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="bg-red-500/5 border border-red-500/15 rounded-sm p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-serif text-red-400 italic">{t("dashboard.settings.dangerTitle")}</h3>
                  <p className="text-[10px] text-gray-600 font-sans mt-0.5">{t("dashboard.team.dangerSubtitle")}</p>
                </div>
              </div>

              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-sm transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> {t("dashboard.team.deleteWorkspace")}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-red-400 font-sans">{t("dashboard.team.confirmDelete")}</p>
                  <button onClick={() => void handleDeleteWorkspace()} disabled={deletingWorkspace} className="flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-red-600 transition-colors disabled:opacity-50">
                    {deletingWorkspace ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} {t("dashboard.team.yesDelete")}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-gray-500 hover:text-white uppercase tracking-widest px-4 py-2 border border-white/10 rounded-sm transition-colors">{t("common.cancel")}</button>
                </div>
              )}
            </Motion.div>
          ) : (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="p-4 bg-white/3 border border-white/8 rounded-sm flex items-center gap-3"
            >
              <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <p className="text-xs text-gray-500 font-sans">
                {t("dashboard.team.memberNotice")}
              </p>
            </Motion.div>
          )}
        </div>
      )}
    </div>
  );
}
