"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Trash2, RotateCcw, AlertCircle, File, Loader2,
  FolderOpen, Image, Film, Archive, Box, FileText, ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { useTrash } from "@/hooks/use-trash";
import { formatDateValue, getFileStableId } from "@/lib/projects/model";
import type { ProjectFileRecord, ProjectRecord } from "@/lib/projects/types";

type ConfirmModalTarget =
  | { type: "project"; project: ProjectRecord }
  | { type: "file"; file: ProjectFileRecord }
  | { type: "bulk-projects" }
  | { type: "bulk-files" };

function ConfirmModal({
  title, message, onConfirm, onCancel, loading,
}: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const t = useTranslations("dashboard.trash");
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-[#0d0f13] border border-red-500/20 rounded-sm p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h3 className="font-serif text-xl text-white italic mb-2">{title}</h3>
        <p className="text-sm font-sans text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 text-xs font-sans font-bold uppercase tracking-widest border border-white/10 text-gray-400 hover:text-white rounded-sm transition-colors disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 text-xs font-sans font-bold uppercase tracking-widest bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("permanentDelete")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SelectionCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className="relative flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm border border-white/10 bg-white/5 text-primary transition-colors hover:border-primary/50"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
        aria-label={label}
      />
      <span className="h-2.5 w-2.5 rounded-[1px] bg-primary opacity-0 transition-opacity peer-checked:opacity-100" />
    </label>
  );
}

function BulkActionBar({
  count,
  itemLabel,
  onClear,
  onRestore,
  onDelete,
}: {
  count: number;
  itemLabel: string;
  onClear: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("dashboard.trash");
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 bg-[#0d0f13] border border-white/10 rounded-sm px-4 py-3 shadow-2xl shadow-black/40"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-sans font-bold uppercase tracking-widest text-primary">{t("selected", { count, itemLabel })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onClear} className="px-4 py-2 text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors">{t("clear")}</button>
          <button onClick={onRestore} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white hover:border-primary/40 hover:text-primary rounded-sm text-xs font-sans font-bold uppercase tracking-widest transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> {t("restore")}
          </button>
          <button onClick={onDelete} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-sm text-xs font-sans font-bold uppercase tracking-widest transition-all">
            <Trash2 className="w-3.5 h-3.5" /> {t("permanentDelete")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function timeAgo(value: unknown, t: ReturnType<typeof useTranslations>) {
  const date = formatDateValue(value);
  if (!date) return "";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return t("dashboard.trash.justNow");
  if (diff < 3600) return t("dashboard.trash.minutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 86400) return t("dashboard.trash.hoursAgo", { count: Math.floor(diff / 3600) });
  return t("dashboard.trash.daysAgo", { count: Math.floor(diff / 86400) });
}

function fileIcon(type: string) {
  const t = (type || "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(t)) return Image;
  if (["mp4", "mov", "avi"].includes(t)) return Film;
  if (["zip", "rar", "7z"].includes(t)) return Archive;
  if (["dwg", "dxf"].includes(t)) return Box;
  if (t === "pdf") return FileText;
  return File;
}

export default function CopKutusuPage() {
  const t = useTranslations();
  const { currentUser } = useAuth();
  const isPasswordUser = Boolean(currentUser?.providerData.some((provider) => provider?.providerId === "password"));
  const projectMutationMessage = t("errors.emailVerificationRequiredTrash");
  const canManageTrash = currentUser ? (!isPasswordUser || currentUser.emailVerified) : false;
  const [activeTab, setActiveTab] = useState<"projects" | "files">("projects");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalTarget | null>(null);

  const {
    deletedProjects,
    deletedFiles,
    deletedFilesTotal,
    loading,
    loadingMore,
    filesLoadingMore,
    processingId,
    processingIds,
    hasMore,
    filesHasMore,
    loadMoreProjects,
    loadMoreFiles,
    restoreProject,
    permanentlyDeleteProject,
    batchRestoreProjects,
    batchPermanentlyDeleteProjects,
    restoreFile,
    permanentlyDeleteFile,
    batchRestoreFiles,
    batchPermanentlyDeleteFiles,
  } = useTrash(currentUser?.uid ?? null, canManageTrash, projectMutationMessage, null, currentUser?.email ?? null, currentUser?.displayName ?? t("common.user"));

  const selectedProjects = useMemo(
    () => deletedProjects.filter((project) => selectedProjectIds.includes(project.id)),
    [deletedProjects, selectedProjectIds],
  );

  const selectedFiles = useMemo(
    () => deletedFiles.filter((file) => selectedFileIds.includes(getFileStableId(file))),
    [deletedFiles, selectedFileIds],
  );

  const confirmModalCopy = useMemo(() => {
    if (!confirmModal) return null;

    if (confirmModal.type === "project") {
      return {
        title: t("dashboard.trash.projectDeleteTitle"),
        message: t("dashboard.trash.projectDeleteMessage", { name: confirmModal.project.name }),
      };
    }

    if (confirmModal.type === "file") {
      return {
        title: t("dashboard.trash.fileDeleteTitle"),
        message: t("dashboard.trash.fileDeleteMessage", { name: confirmModal.file.name }),
      };
    }

    if (confirmModal.type === "bulk-projects") {
      return {
        title: t("dashboard.trash.bulkProjectsDeleteTitle"),
        message: t("dashboard.trash.bulkProjectsDeleteMessage", { count: selectedProjects.length }),
      };
    }

    return {
      title: t("dashboard.trash.bulkFilesDeleteTitle"),
      message: t("dashboard.trash.bulkFilesDeleteMessage", { count: selectedFiles.length }),
    };
  }, [confirmModal, selectedFiles.length, selectedProjects.length, t]);

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((current) => (
      current.includes(projectId)
        ? current.filter((selectedId) => selectedId !== projectId)
        : [...current, projectId]
    ));
  }

  function toggleFileSelection(file: ProjectFileRecord) {
    const fileId = getFileStableId(file);
    setSelectedFileIds((current) => (
      current.includes(fileId)
        ? current.filter((selectedId) => selectedId !== fileId)
        : [...current, fileId]
    ));
  }

  function getSelectedFileItems() {
    return selectedFiles.map((file) => {
      if (!file.projectId) {
        throw new Error(t("errors.fileProjectMissing"));
      }

      return { projectId: file.projectId, file };
    });
  }

  async function handleRestoreProject(projectId: string, projectName: string) {
    try {
      await restoreProject(projectId);
      setSelectedProjectIds((current) => current.filter((selectedId) => selectedId !== projectId));
      toast.success(t("dashboard.trash.projectRestored", { name: projectName }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.trash.projectRestoreFailed"));
    }
  }

  async function handleRestoreFile(projectId: string, fileName: string, file: ProjectFileRecord) {
    try {
      await restoreFile(projectId, file);
      setSelectedFileIds((current) => current.filter((selectedId) => selectedId !== getFileStableId(file)));
      toast.success(t("dashboard.trash.fileRestored", { name: fileName }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.trash.fileRestoreFailed"));
    }
  }

  async function handleBulkRestoreProjects() {
    try {
      await batchRestoreProjects(selectedProjectIds);
      toast.success(t("dashboard.trash.projectsRestored", { count: selectedProjectIds.length }));
      setSelectedProjectIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.trash.projectsRestoreFailed"));
    }
  }

  async function handleBulkRestoreFiles() {
    try {
      const items = getSelectedFileItems();
      await batchRestoreFiles(items);
      toast.success(t("dashboard.trash.filesRestored", { count: items.length }));
      setSelectedFileIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.trash.filesRestoreFailed"));
    }
  }

  async function handlePermanentDelete() {
    if (!confirmModal) return;

    try {
      if (confirmModal.type === "project") {
        await permanentlyDeleteProject(confirmModal.project);
        setSelectedProjectIds((current) => current.filter((selectedId) => selectedId !== confirmModal.project.id));
        toast.success(t("dashboard.trash.projectDeleted", { name: confirmModal.project.name }));
      } else if (confirmModal.type === "file") {
        if (!confirmModal.file.projectId) {
          throw new Error(t("errors.fileProjectMissing"));
        }
        await permanentlyDeleteFile(confirmModal.file.projectId, confirmModal.file);
        setSelectedFileIds((current) => current.filter((selectedId) => selectedId !== getFileStableId(confirmModal.file)));
        toast.success(t("dashboard.trash.fileDeleted", { name: confirmModal.file.name }));
      } else if (confirmModal.type === "bulk-projects") {
        await batchPermanentlyDeleteProjects(selectedProjects);
        toast.success(t("dashboard.trash.projectsDeleted", { count: selectedProjects.length }));
        setSelectedProjectIds([]);
      } else {
        const items = getSelectedFileItems();
        await batchPermanentlyDeleteFiles(items);
        toast.success(t("dashboard.trash.filesDeleted", { count: items.length }));
        setSelectedFileIds([]);
      }
      setConfirmModal(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.trash.deleteFailed"));
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-white italic flex items-center gap-3 mb-2">
          <Trash2 className="w-7 h-7 text-primary" /> {t("dashboard.trash.title")}
        </h1>
        <p className="text-sm font-sans text-gray-400">
          {t("dashboard.trash.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-white/5 mb-8">
        {[
          { id: "projects" as const, label: t("dashboard.trash.projectsTab", { count: deletedProjects.length }) },
          { id: "files" as const, label: t("dashboard.trash.filesTab", { count: deletedFilesTotal }) },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-xs font-sans font-bold uppercase tracking-widest border-b-2 transition-colors -mb-px ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "projects" && (
          <motion.div
            key="projects"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : deletedProjects.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-sm py-20 text-center">
                <FolderOpen className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-sans text-sm">{t("dashboard.trash.projectsEmpty")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deletedProjects.map((project) => {
                  const isSelected = selectedProjectIds.includes(project.id);
                  const isProcessing = processingIds.includes(project.id) || processingId === project.id;

                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      className={`bg-[#0d0f13] border p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${isSelected ? "border-primary/50" : "border-white/5 hover:border-white/10"}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <SelectionCheckbox checked={isSelected} label={t("dashboard.trash.selectProject", { name: project.name })} onChange={() => toggleProjectSelection(project.id)} />
                        <div className="w-10 h-10 rounded-sm bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white font-serif text-base italic truncate">{project.name}</h3>
                          <p className="text-xs text-gray-500 font-sans mt-0.5">
                            {t("dashboard.trash.deletedAt", { time: timeAgo(project.deletedAt, t) })} • {t("dashboard.trash.filesCount", { count: Object.values(project.fileCount || {}).reduce((sum, value) => sum + value, 0) + (project.deletedFiles?.length || 0) })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleRestoreProject(project.id, project.name)} disabled={isProcessing} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-sm text-xs font-sans font-bold uppercase tracking-wider transition-colors disabled:opacity-50">
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} {t("dashboard.trash.restore")}
                        </button>
                        <button
                          onClick={() => setConfirmModal({ type: "project", project })}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 rounded-sm text-xs font-sans font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t("dashboard.trash.permanentDelete")}
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
                  onClick={() => void loadMoreProjects()}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:border-primary/40 hover:text-white transition-all disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {t("dashboard.trash.loadMore")}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "files" && (
          <motion.div
            key="files"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : deletedFiles.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-sm py-20 text-center">
                <File className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-sans text-sm">{t("dashboard.trash.filesEmpty")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deletedFiles.map((file) => {
                  const FileIcon = fileIcon(file.type || file.name);
                  const fileId = getFileStableId(file);
                  const isSelected = selectedFileIds.includes(fileId);
                  const isProcessing = processingIds.includes(file.url || file.name) || processingId === (file.url || file.name);

                  return (
                    <motion.div
                      key={fileId}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      className={`bg-[#0d0f13] border p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${isSelected ? "border-primary/50" : "border-white/5 hover:border-white/10"}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <SelectionCheckbox checked={isSelected} label={t("dashboard.trash.selectFile", { name: file.name })} onChange={() => toggleFileSelection(file)} />
                        <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <FileIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-white font-serif text-base italic truncate">{file.name}</h3>
                          <p className="text-xs text-gray-500 font-sans mt-0.5">
                            {file.projectName || t("dashboard.trash.projectFallback")} • {t("dashboard.trash.deletedAt", { time: timeAgo(file.deletedAt, t) })} • {formatBytes(file.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => file.projectId ? handleRestoreFile(file.projectId, file.name, file) : toast.error(t("errors.fileProjectMissing"))}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-sm text-xs font-sans font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} {t("dashboard.trash.restore")}
                        </button>
                        <button
                          onClick={() => setConfirmModal({ type: "file", file })}
                          disabled={isProcessing}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 rounded-sm text-xs font-sans font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t("dashboard.trash.permanentDelete")}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            {filesHasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => void loadMoreFiles()}
                  disabled={filesLoadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:border-primary/40 hover:text-white transition-all disabled:opacity-50"
                >
                  {filesLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {t("dashboard.trash.loadMore")}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === "projects" && selectedProjectIds.length > 0 && (
          <BulkActionBar
            count={selectedProjectIds.length}
            itemLabel={t("dashboard.trash.projectItemLabel")}
            onClear={() => setSelectedProjectIds([])}
            onRestore={() => void handleBulkRestoreProjects()}
            onDelete={() => setConfirmModal({ type: "bulk-projects" })}
          />
        )}
        {activeTab === "files" && selectedFileIds.length > 0 && (
          <BulkActionBar
            count={selectedFileIds.length}
            itemLabel={t("dashboard.trash.fileItemLabel")}
            onClear={() => setSelectedFileIds([])}
            onRestore={() => void handleBulkRestoreFiles()}
            onDelete={() => setConfirmModal({ type: "bulk-files" })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal && confirmModalCopy && (
          <ConfirmModal
            title={confirmModalCopy.title}
            message={confirmModalCopy.message}
            loading={Boolean(processingId || processingIds.length)}
            onConfirm={handlePermanentDelete}
            onCancel={() => setConfirmModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
