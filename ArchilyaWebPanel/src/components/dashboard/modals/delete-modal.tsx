"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import type { ProjectRecord } from "@/lib/projects/types";

export function DeleteModal({
  project,
  onClose,
  onDelete,
}: {
  project: ProjectRecord;
  onClose: () => void;
  onDelete: (project: ProjectRecord) => Promise<void>;
}) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      await onDelete(project);
      toast.success(t("dashboard.projects.movedToTrash"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.projects.moveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="w-full max-w-sm bg-[#0d0f13] border border-red-500/20 rounded-sm p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h3 id="delete-title" className="font-serif text-xl text-white italic mb-2">{t("dashboard.projects.moveToTrash")}</h3>
        <p id="delete-desc" className="text-sm font-sans text-gray-400 mb-6">
          {t("dashboard.projects.moveToTrashDescription", { projectName: project.name })}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 text-xs font-sans font-bold uppercase tracking-widest border border-white/10 text-gray-400 hover:text-white rounded-sm transition-colors disabled:opacity-50">{t("common.cancel")}</button>
          <button onClick={handleDelete} disabled={loading} className="flex-1 py-2.5 text-xs font-sans font-bold uppercase tracking-widest bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} {loading ? t("dashboard.projects.moving") : t("common.delete")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
