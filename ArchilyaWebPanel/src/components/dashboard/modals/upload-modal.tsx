"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import { useFileUpload } from "@/hooks/use-file-upload";
import { formatBytes } from "@/lib/utils/format";
import type { ProjectRecord } from "@/lib/projects/types";

export function UploadModal({
  project,
  onClose,
  ownerUid,
  ownerName,
  onUploaded,
}: {
  project: ProjectRecord;
  onClose: () => void;
  ownerUid: string;
  ownerName: string;
  onUploaded: () => Promise<void>;
}) {
  const t = useTranslations();
  const [files, setFiles] = useState<File[]>([]);
  const { uploading, progress, uploadFiles } = useFileUpload();

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    setFiles((current) => [...current, ...picked]);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleUpload() {
    if (!files.length) {
      toast.error(t("dashboard.projects.selectFileRequired"));
      return;
    }

    try {
      await uploadFiles(project, files, ownerUid, ownerName);
      await onUploaded();
      toast.success(t("dashboard.projects.uploaded"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.projects.uploadFailed"));
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
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        aria-describedby="upload-desc"
        className="w-full max-w-lg bg-[#0d0f13] border border-white/10 rounded-sm p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label={t("common.close")} className="absolute top-4 right-4 text-gray-600 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">{t("dashboard.projects.archive")}</p>
        <h2 id="upload-title" className="text-2xl font-serif text-white italic mb-1">{t("dashboard.projects.uploadTitle")}</h2>
        <p id="upload-desc" className="text-xs font-sans text-gray-500 mb-6">{t("dashboard.projects.uploadDescription", { projectName: project.name })}</p>
        <label className="block w-full border-2 border-dashed border-white/10 hover:border-primary/40 rounded-sm p-8 text-center cursor-pointer transition-colors mb-4 group">
          <Upload className="w-8 h-8 text-gray-600 group-hover:text-primary mx-auto mb-2 transition-colors" />
          <p className="text-sm font-sans text-gray-500 group-hover:text-gray-300 transition-colors">{t("dashboard.projects.dropFiles")}</p>
          <p className="text-[10px] text-gray-700 mt-1">PDF, DWG, DXF, JPG, PNG, MP4, ZIP</p>
          <input type="file" multiple onChange={handleFilePick} className="hidden" />
        </label>

        {files.length > 0 && (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-sm px-3 py-2">
                <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-sans text-white truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-gray-600">{formatBytes(file.size)}</p>
                    {progress[file.name] !== undefined && (
                      <div className="flex-1 h-1 bg-white/10 rounded-full">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${progress[file.name]}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                {!uploading && (
                  <button onClick={() => removeFile(index)} className="text-gray-600 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={handleUpload} disabled={uploading} className="w-full bg-primary text-black font-sans font-bold text-xs uppercase tracking-widest py-3 rounded-sm hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
          {uploading ? t("dashboard.projects.uploading") : t("dashboard.projects.uploadFiles")}
        </button>
      </motion.div>
    </motion.div>
  );
}
