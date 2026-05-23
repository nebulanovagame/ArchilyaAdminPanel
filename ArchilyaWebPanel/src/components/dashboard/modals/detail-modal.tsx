"use client";

import { motion } from "framer-motion";
import { X, FileText, Box } from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatBytes } from "@/lib/utils/format";
import type { ProjectRecord } from "@/lib/projects/types";

const STATUS_COLORS: Record<string, string> = {
  Aktif: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  "İncelemede": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Tamamlandı: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Taslak: "text-gray-400 bg-gray-400/10 border-gray-400/20",
};

export function DetailModal({ project, onClose }: { project: ProjectRecord; onClose: () => void }) {
  const t = useTranslations();
  const statusLabel = project.status === "Aktif"
    ? t("dashboard.projects.statusActive")
    : project.status === "İncelemede"
      ? t("dashboard.projects.statusReview")
      : project.status === "Tamamlandı"
        ? t("dashboard.projects.statusCompleted")
        : t("dashboard.projects.statusDraft");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        aria-describedby="detail-desc"
        className="w-full max-w-lg bg-[#0d0f13] border border-white/10 rounded-sm p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label={t("common.close")} className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">{t("dashboard.projects.archive")}</p>
        <h2 id="detail-title" className="text-2xl font-serif text-white italic mb-2">{project.name}</h2>
        <p id="detail-desc" className="text-xs font-sans text-gray-500 mb-6">{project.location || t("dashboard.projects.detailsFallback")}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-sm p-4">
            <p className="text-[10px] font-sans text-gray-500 uppercase tracking-widest mb-1.5">{t("dashboard.projects.status")}</p>
            <span className={`inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[project.status] || STATUS_COLORS.Taslak}`}>
              {statusLabel}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-sm p-4">
            <p className="text-[10px] font-sans text-gray-500 uppercase tracking-widest mb-1.5">{t("dashboard.projects.archiveSize")}</p>
            <p className="text-sm text-white font-sans">{formatBytes(project.totalSize)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { label: "PDF", value: project.fileCount.pdf, icon: FileText },
            { label: "DWG", value: project.fileCount.dwg, icon: Box },
            { label: t("dashboard.projects.image"), value: project.fileCount.img, icon: ImageIcon },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/5 rounded-sm">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-xs font-sans text-gray-300 uppercase tracking-widest">{label}</span>
              </div>
              <span className="text-sm text-white font-serif">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
