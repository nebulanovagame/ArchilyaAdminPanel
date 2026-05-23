"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export function BulkDeleteModal({
  count,
  onClose,
  onDelete,
}: {
  count: number;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      await onDelete();
      toast.success(t("dashboard.projects.bulkMovedToTrash", { count }));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.projects.bulkMoveFailed"));
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
        aria-labelledby="bulk-delete-title"
        aria-describedby="bulk-delete-desc"
        className="w-full max-w-sm bg-[#0d0f13] border border-red-500/20 rounded-sm p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h3 id="bulk-delete-title" className="font-serif text-xl text-white italic mb-2">{t("dashboard.projects.bulkDeleteTitle")}</h3>
        <p id="bulk-delete-desc" className="text-sm font-sans text-gray-400 mb-6">
          {t("dashboard.projects.bulkDeleteDescription", { count })}
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
