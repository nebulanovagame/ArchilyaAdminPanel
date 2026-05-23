"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  FileText,
  Box,
  Clock,
  Users,
  Sparkles,
  TrendingUp,
  HardDrive,
  Upload,
  Download,
  Wand2,
  Layers,
  Lock,
  ChevronRight,
  Plus,
  X,
  Trash2,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useProjects } from "@/hooks/use-projects";
import { formatDateValue } from "@/lib/projects/model";
import type { CreateProjectInput, ProjectRecord } from "@/lib/projects/types";
import WelcomeModal from "@/components/onboarding/welcome-modal";
import { checkHasSeenOnboarding, markOnboardingSeen } from "@/lib/onboarding/service";
import { formatBytes, timeAgo } from "@/lib/utils/format";
import {
  DetailModal,
  AddProjectModal,
  UploadModal,
  DeleteModal,
  BulkDeleteModal,
} from "@/components/dashboard/modals";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const AI_TOOLS = [
  { icon: Wand2, name: "Render AI", desc: "Ham BIM modelinizi tek tıkla fotorealistik render'a dönüştürün.", credit: 50, badge: "Yakında" },
  { icon: Layers, name: "Plan Optimizer", desc: "Kat planlarınızı AI ile analiz edin, optimizasyon önerileri alın.", credit: 30, badge: "Beta" },
  { icon: ImageIcon, name: "Style Transfer", desc: "Referans görsellerin stilini proje render'larınıza uygulayın.", credit: 20, badge: "Yakında" },
];

const STATUS_COLORS: Record<string, string> = {
  Aktif: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "İncelemede": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Tamamlandı: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Taslak: "text-gray-400 bg-gray-400/10 border-gray-400/20",
};

function SectionHeader({ label, title, action, onAction }: { label: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">{label}</p>
        <h2 className="text-2xl font-serif text-white italic">{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className="flex items-center gap-1.5 text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest">
          {action} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<ProjectRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<ProjectRecord | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("createProject") === "1") {
      handleStartProjectCreation();
      router.replace(pathname);
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let mounted = true;
    checkHasSeenOnboarding(currentUser.uid).then((seen) => {
      if (mounted && !seen) {
        setShowOnboarding(true);
      }
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, [currentUser?.uid]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const ownerName = currentUser?.displayName?.trim() || currentUser?.email?.split("@")[0] || "Kullanıcı";
  const isPasswordUser = Boolean(currentUser?.providerData.some((provider) => provider?.providerId === "password"));
  const projectMutationMessage = "Proje ve arşiv işlemleri için önce e-posta doğrulamanızı tamamlayın.";
  const canManageProjects = currentUser ? (!isPasswordUser || currentUser.emailVerified) : false;
  const {
    projects,
    stats,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    createProject,
    softDeleteProject,
    batchSoftDelete,
  } = useProjects(currentUser?.uid ?? null, currentUser?.email ?? null, ownerName, canManageProjects, projectMutationMessage, null);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedProjectIds.includes(project.id)),
    [projects, selectedProjectIds],
  );

  function handleStartProjectCreation() {
    if (!canManageProjects) {
      toast.error(projectMutationMessage);
      return;
    }

    setShowAddModal(true);
  }

  async function handleInstallApp() {
    if (!installPrompt) {
      toast("Tarayıcınızın menüsünden ana ekrana ekleyebilirsiniz.");
      return;
    }
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      toast("Uygulama yükleniyor...");
    }
    setInstallPrompt(null);
  }

  function handleStartUpload(project: ProjectRecord) {
    if (!canManageProjects) {
      toast.error(projectMutationMessage);
      return;
    }

    setUploadTarget(project);
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((current) => (
      current.includes(projectId)
        ? current.filter((selectedId) => selectedId !== projectId)
        : [...current, projectId]
    ));
  }

  async function handleBulkSoftDelete() {
    const projectIds = selectedProjects.map((project) => project.id);

    if (!projectIds.length) return;

    await batchSoftDelete(projectIds);
    setSelectedProjectIds([]);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const today = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const statsCards = useMemo(
    () => [
      { icon: FolderOpen, label: "Aktif Proje", value: String(stats.activeCount), sub: `${stats.totalProjectCount} proje toplam`, color: "text-primary" },
      { icon: HardDrive, label: "Arşiv Boyutu", value: formatBytes(stats.totalSize), sub: "Depolama", color: "text-blue-400" },
      { icon: FileText, label: "Toplam Dosya", value: String(stats.totalFiles), sub: "PDF, DWG, Görsel", color: "text-emerald-400" },
      { icon: Users, label: "Ekip Üyesi", value: String(stats.uniqueMemberCount), sub: "Projelerinizde erişimi olanlar", color: "text-violet-400" },
    ],
    [stats],
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-primary text-xs uppercase tracking-[0.25em] font-sans mb-1">{today}</p>
          <h1 className="text-3xl md:text-4xl font-serif text-white italic">{greeting}, {ownerName}.</h1>
          <p className="text-gray-500 font-sans text-sm mt-1">Platformunuza hoş geldiniz. İşte bugünkü özet.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStartProjectCreation} className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-primary/40 text-gray-300 hover:text-white px-4 py-2.5 rounded-sm text-xs font-sans font-bold uppercase tracking-widest transition-all duration-300">
            <Plus className="w-3.5 h-3.5" /> Yeni Proje
          </button>
          <button type="button" onClick={handleInstallApp} className="flex items-center gap-2 bg-primary text-black px-4 py-2.5 rounded-sm text-xs font-sans font-bold uppercase tracking-widest hover:bg-white transition-all duration-300">
            <Download className="w-3.5 h-3.5" /> Masaüstü Uygulama
          </button>
        </div>
      </motion.div>

      {error && <div className="mb-6 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error.message}</div>}

      <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }} className="bg-[#0d0f13] border border-white/5 rounded-sm p-5 hover:border-primary/20 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-sm bg-white/5 group-hover:bg-primary/10 transition-colors ${stat.color}`}><Icon className="w-4 h-4" /></div>
                <TrendingUp className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-2xl font-serif text-white mb-1">{loading ? "..." : stat.value}</p>
              <p className="text-[10px] font-sans text-gray-500 uppercase tracking-widest">{stat.label}</p>
              <p className="text-[10px] font-sans text-gray-700 mt-1">{stat.sub}</p>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mb-10">
        <SectionHeader label="Arşiv" title="Projelerim" action="Yeni Proje" onAction={handleStartProjectCreation} />

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-sm py-20 text-center">
            <FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 font-sans text-sm mb-2">Henüz bir projeniz yok.</p>
            <button onClick={handleStartProjectCreation} className="mt-4 inline-flex items-center gap-2 bg-primary text-black px-4 py-2.5 rounded-sm text-xs font-sans font-bold uppercase tracking-widest hover:bg-white transition-all duration-300">
              <Plus className="w-3.5 h-3.5" /> İlk Projeyi Oluştur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project, index) => {
              const isSelected = selectedProjectIds.includes(project.id);

              return (
              <motion.div key={project.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.06 }} className={`bg-[#0d0f13] border rounded-sm overflow-hidden hover:border-primary/25 transition-all duration-300 group ${isSelected ? "border-primary/50 shadow-[0_0_0_1px_rgba(202,167,95,0.15)]" : "border-white/5"}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <label className="relative mt-1 flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm border border-white/10 bg-white/5 text-primary transition-colors hover:border-primary/50">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProjectSelection(project.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="peer sr-only"
                          aria-label={`${project.name} projesini seç`}
                        />
                        <span className="h-2.5 w-2.5 rounded-[1px] bg-primary opacity-0 transition-opacity peer-checked:opacity-100" />
                      </label>
                      <div className="min-w-0">
                      <h3 className="text-base font-serif text-white italic group-hover:text-primary transition-colors">{project.name}</h3>
                      {project.location && <p className="text-[10px] font-sans text-gray-600 mt-0.5">{project.location}</p>}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[project.status] || STATUS_COLORS.Taslak}`}>{project.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex items-center gap-1 text-[10px] font-sans text-gray-600"><FileText className="w-3 h-3" /> {project.fileCount.pdf} PDF</span>
                    <span className="flex items-center gap-1 text-[10px] font-sans text-gray-600"><Box className="w-3 h-3" /> {project.fileCount.dwg} DWG</span>
                    <span className="flex items-center gap-1 text-[10px] font-sans text-gray-600"><ImageIcon className="w-3 h-3" /> {project.fileCount.img} Görsel</span>
                    {project.totalSize > 0 && <span className="ml-auto text-[10px] font-sans text-gray-700">{formatBytes(project.totalSize)}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] font-sans text-gray-700"><Clock className="w-2.5 h-2.5" /> {timeAgo(project.updatedAt)}</div>
                  </div>
                </div>
                <div className="border-t border-white/5 flex">
                  <button onClick={() => setDetailTarget(project)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-sans text-gray-600 hover:text-primary hover:bg-white/3 transition-colors uppercase tracking-widest">
                    <ExternalLink className="w-3 h-3" /> Detay
                  </button>
                  <div className="w-px bg-white/5" />
                  <button onClick={() => handleStartUpload(project)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-sans text-gray-600 hover:text-primary hover:bg-white/3 transition-colors uppercase tracking-widest">
                    <Upload className="w-3 h-3" /> Yükle
                  </button>
                  <div className="w-px bg-white/5" />
                  <button onClick={() => setDeleteTarget(project)} className="px-4 flex items-center justify-center text-gray-700 hover:text-red-400 hover:bg-red-400/5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:border-primary/40 hover:text-white transition-all disabled:opacity-50"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Daha Fazla Yükle
            </button>
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
        <SectionHeader label="Yapay Zeka" title="AI Araçları" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AI_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.name} className="relative bg-[#0d0f13] border border-white/5 rounded-sm p-5 overflow-hidden group hover:border-primary/20 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex flex-col items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    <span className="text-xs font-sans font-bold text-white uppercase tracking-widest">Yakında</span>
                  </div>
                </div>
                <div className="relative z-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 rounded-sm bg-primary/10 text-primary border border-primary/15"><Icon className="w-4 h-4" /></div>
                    <span className="text-[9px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider border border-primary/20">{tool.badge}</span>
                  </div>
                  <h3 className="text-base font-serif text-white italic mb-1">{tool.name}</h3>
                  <p className="text-xs font-sans text-gray-500 leading-relaxed mb-4">{tool.desc}</p>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs font-sans font-bold text-primary">{tool.credit} Kredi</span>
                    <span className="text-[10px] text-gray-700">/ kullanım</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedProjectIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 bg-[#0d0f13] border border-white/10 rounded-sm px-4 py-3 shadow-2xl shadow-black/40"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-sans font-bold uppercase tracking-widest text-primary">{selectedProjectIds.length} proje seçildi</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedProjectIds([])} className="px-4 py-2 text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Temizle</button>
                <button onClick={() => setShowBulkDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-sm text-xs font-sans font-bold uppercase tracking-widest transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Toplu Sil
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WelcomeModal
        open={showOnboarding}
        onFinish={() => {
          setShowOnboarding(false);
          if (currentUser?.uid) {
            void markOnboardingSeen(currentUser.uid);
          }
        }}
      />

      <AnimatePresence>
        {showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} onAdd={createProject} />}
        {uploadTarget && currentUser?.uid && <UploadModal project={uploadTarget} ownerUid={currentUser.uid} ownerName={ownerName} onUploaded={refresh} onClose={() => setUploadTarget(null)} />}
        {deleteTarget && <DeleteModal project={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={(project) => softDeleteProject(project.id)} />}
        {detailTarget && <DetailModal project={detailTarget} onClose={() => setDetailTarget(null)} />}
        {showBulkDeleteModal && <BulkDeleteModal count={selectedProjectIds.length} onClose={() => setShowBulkDeleteModal(false)} onDelete={handleBulkSoftDelete} />}
      </AnimatePresence>
    </div>
  );
}
