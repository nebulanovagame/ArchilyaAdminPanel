"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Sparkles,
  FolderOpen,
  HardDrive,
  Cpu,
  Plus,
  ChevronRight,
  Loader2,
  Clock,
  Upload,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { useAuth } from "@/components/providers/auth-provider";
import { useCredits, formatCredits } from "@/hooks/use-credits";
import { useWorkspace } from "@/hooks/use-workspace";
import { useProjects } from "@/hooks/use-projects";
import { timeAgo, formatBytes } from "@/lib/utils/format";
import type { ProjectRecord } from "@/lib/projects/types";

/* ─── Stat Card ────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-5 flex items-start gap-4 hover:border-white/10 transition-colors">
      <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${color} bg-opacity-10 shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gray-600 mb-1">{label}</p>
        <p className="text-2xl font-serif text-white italic leading-tight">{value}</p>
        {sub && <p className="text-[11px] font-sans text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Quick Action ─────────────────────────────── */

function QuickAction({
  href,
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  onClick?: () => void;
}) {
  const base = "flex items-center gap-4 bg-[#0d0f13] border border-white/5 rounded-sm p-4 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 group cursor-pointer";
  const inner = (
    <>
      <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-sans font-bold text-white group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] font-sans text-gray-600 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-primary transition-colors shrink-0" />
    </>
  );

  if (href) {
    return <Link href={href} className={base}>{inner}</Link>;
  }
  return <button type="button" onClick={onClick} className={`${base} w-full text-left`}>{inner}</button>;
}

/* ─── Project Row ──────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  Aktif: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "İncelemede": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Tamamlandı: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Taslak: "text-gray-400 bg-gray-400/10 border-gray-400/20",
};

function ProjectRow({
  project,
  onUpload,
  onDelete,
}: {
  project: ProjectRecord;
  onUpload: (p: ProjectRecord) => void;
  onDelete: (p: ProjectRecord) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-sm hover:bg-white/5 transition-colors group border border-transparent hover:border-white/5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-serif text-white italic group-hover:text-primary transition-colors truncate">
          {project.name}
        </p>
        {project.location && (
          <p className="text-[10px] font-sans text-gray-700 mt-0.5 truncate">{project.location}</p>
        )}
      </div>
      <span
        className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
          STATUS_COLORS[project.status] || STATUS_COLORS.Taslak
        }`}
      >
        {project.status}
      </span>
      <div className="flex items-center gap-1 text-[10px] font-sans text-gray-700 flex-shrink-0 w-20 text-right">
        <Clock className="w-2.5 h-2.5" />
        {timeAgo(project.updatedAt)}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          onClick={() => onUpload(project)}
          className="p-1.5 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-sm transition-all"
          title="Dosya Yükle"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(project)}
          className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-sm transition-all"
          title="Projeyi Sil"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Empty State ──────────────────────────────── */

function EmptyState() {
  return (
    <div className="border border-dashed border-white/10 rounded-sm py-12 text-center">
      <FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" />
      <p className="text-gray-500 font-sans text-sm">Henüz bir projeniz yok.</p>
      <p className="text-[11px] font-sans text-gray-700 mt-1">Yeni bir proje oluşturarak başlayın.</p>
    </div>
  );
}

/* ─── Section Header ───────────────────────────── */

function SectionHeader({
  label,
  title,
  action,
  onAction,
}: {
  label: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">{label}</p>
        <h2 className="text-xl font-serif text-white italic">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-1.5 text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest"
        >
          {action} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────── */

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { credits, plan, loading: creditsLoading } = useCredits();
  const { activeWorkspace } = useWorkspace();

  const ownerName =
    currentUser?.displayName?.trim() ||
    currentUser?.email?.split("@")[0] ||
    "Kullanıcı";

  const isPasswordUser = Boolean(
    currentUser?.providerData.some((p) => p?.providerId === "password"),
  );
  const canManageProjects = currentUser
    ? !isPasswordUser || currentUser.emailVerified
    : false;
  const projectMutationMessage =
    "Proje işlemleri için e-posta doğrulamanızı tamamlayın.";

  const {
    projects,
    loading: projectsLoading,
    hasMore,
    loadingMore,
    loadMore,
    softDeleteProject,
  } = useProjects(
    currentUser?.uid ?? null,
    currentUser?.email ?? null,
    ownerName,
    canManageProjects,
    projectMutationMessage,
    null,
  );

  const recentProjects = useMemo(() => projects.slice(0, 5), [projects]);
  const totalProjects = projects.length;

  // Pool credits take priority over personal credits for display
  const displayCredits =
    activeWorkspace?.poolCredits ?? credits ?? 0;
  const displayPlan =
    activeWorkspace?.plan === "pro" || activeWorkspace?.plan === "studio"
      ? activeWorkspace.plan
      : plan;

  const planLabel =
    displayPlan === "solo"
      ? "Solo"
      : displayPlan === "pro"
        ? "Pro"
        : displayPlan === "studio"
          ? "Studio"
          : "Keşif";

  // Storage (from workspace pool or a sensible fallback)
  const poolStorage = activeWorkspace?.poolStorage ?? 0;
  const storageLabel = poolStorage > 0 ? formatBytes(poolStorage) : "—";
  const usedStorage = activeWorkspace?.usedStorage
    ? formatBytes(activeWorkspace.usedStorage)
    : undefined;

  // Count of recently updated projects (updated in the last 7 days)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const recentActivityCount = useMemo(
    () =>
      projects.filter((p) => {
        const d = p.updatedAt;
        if (!d) return false;
        const t =
          typeof d === "string"
            ? new Date(d).getTime()
            : d instanceof Date
              ? d.getTime()
              : 0;
        return t > now - 7 * 24 * 60 * 60 * 1000;
      }).length,
    [projects, now],
  );

  const [greeting, setGreeting] = useState("Merhaba");
  useEffect(() => {
    function updateGreeting() {
      const hour = new Date().getHours();
      if (hour < 6) setGreeting("İyi geceler");
      else if (hour < 12) setGreeting("Günaydın");
      else if (hour < 18) setGreeting("Tünaydın");
      else if (hour < 22) setGreeting("İyi akşamlar");
      else setGreeting("İyi geceler");
    }
    updateGreeting();
    const id = setInterval(updateGreeting, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-10">
      {/* ── Welcome ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-white italic">
            {greeting}, {ownerName}
          </h1>
          <p className="text-xs font-sans text-gray-600 mt-1">
            {currentUser?.email ?? ""}
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/20 text-primary">
          {planLabel}
        </span>
      </div>

      {/* ── Stats ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Sparkles}
          label="Kredim"
          value={
            creditsLoading
              ? "—"
              : `${formatCredits(displayCredits)}`
          }
          sub={
            activeWorkspace?.poolCredits != null
              ? "Havuz"
              : `${planLabel} Plan`
          }
          color="text-primary bg-primary"
        />
        <StatCard
          icon={FolderOpen}
          label="Projelerim"
          value={projectsLoading ? "—" : totalProjects}
          sub={totalProjects > 0 ? "Aktif proje" : undefined}
          color="text-emerald-400 bg-emerald-400"
        />
        <StatCard
          icon={HardDrive}
          label="Depolama"
          value={storageLabel}
          sub={usedStorage}
          color="text-blue-400 bg-blue-400"
        />
        <StatCard
          icon={Cpu}
          label="Son 7 Gün"
          value={projectsLoading ? "—" : recentActivityCount}
          sub={recentActivityCount > 0 ? "Güncellenen proje" : "İşlem yok"}
          color="text-amber-400 bg-amber-400"
        />
      </div>

      {/* ── Quick Actions ────────────────────────── */}
      <div>
        <SectionHeader label="Hızlı İşlemler" title="Ne yapmak istersiniz?" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            icon={Plus}
            label="Yeni Proje"
            desc="Proje oluşturup dosya yükleyin"
            onClick={() => {
              const btn = document.querySelector("[data-new-project]") as HTMLButtonElement;
              if (btn) btn.click();
            }}
          />
          <QuickAction
            href="/ai-studio"
            icon={Sparkles}
            label="AI Stüdyo"
            desc="Sketchup görselinizi AI ile premium render'a dönüştürün, revize edin, analiz edin ve sunuma hazırlayın."
          />
          <QuickAction
            href="/abonelik"
            icon={Cpu}
            label="Abonelik"
            desc="Planınızı yükseltin, ek paket alın"
          />
        </div>
      </div>

      {/* ── Recent Projects ──────────────────────── */}
      <div>
        <SectionHeader
          label="Arşiv"
          title="Son Projeler"
          action={hasMore || recentProjects.length >= 5 ? "Tümünü Gör" : undefined}
          onAction={() => {
            if (hasMore) void loadMore();
          }}
        />

        {projectsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-[#0d0f13] border border-white/5 rounded-sm divide-y divide-white/5">
            {recentProjects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onUpload={() => {
                  if (!canManageProjects) return;
                  // Trigger upload via a modal or navigation
                }}
                onDelete={(p) => {
                  softDeleteProject(p.id);
                }}
              />
            ))}
          </div>
        )}

        {hasMore && recentProjects.length > 0 && (
          <div className="flex justify-center mt-5">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:border-primary/40 hover:text-white transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Daha Fazla Yükle
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
