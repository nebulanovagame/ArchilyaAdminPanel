/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import { Upload, X, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

interface ReferenceUploaderProps {
  refImageFile: File | null;
  refImagePreview: string | null;
  primaryDropActive: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
}

export default function ReferenceUploader({
  refImageFile,
  refImagePreview,
  primaryDropActive,
  fileInputRef,
  onFileSelect,
  onClear,
  onDrop,
  onDragOver,
  onDragLeave,
}: ReferenceUploaderProps) {
  const t = useTranslations("dashboard.aiStudio");

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t("referenceRequired")}</p>
          <p className="mt-1 text-[11px] text-gray-500">{t("referenceHelp")}</p>
        </div>
      </div>

      {refImagePreview ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-sm border border-white/10 bg-black/20"
        >
          <div className="relative h-[260px] w-full md:h-[360px]">
            <img src={refImagePreview} alt={t("referenceAlt")} className="h-full w-full object-contain" />
          </div>
          <div className="absolute top-3 left-3 rounded-sm border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gray-200">{t("referenceReady")}</div>
          <div className="absolute right-3 top-3">
            <button onClick={onClear} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-black/70 text-gray-300 hover:border-white/20 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] text-gray-200">{refImageFile?.name || t("sampleReference")}</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:border-primary/40">
              <Upload className="w-4 h-4" /> {t("changeFile")}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onFileSelect(event.target.files[0]); }} className="hidden" />
            </label>
          </div>
        </motion.div>
      ) : refImageFile ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-sm border border-white/10 bg-white/[0.02] p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-white/10 bg-white/5 flex-shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("pdfUploaded")}</p>
                <p className="mt-1 text-sm font-sans text-white truncate">{refImageFile.name}</p>
                <p className="mt-1 text-[11px] text-gray-500">{t("pdfHelp")}</p>
              </div>
            </div>
            <button onClick={onClear} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-black/40 text-gray-300 hover:border-white/20 hover:text-white transition-colors flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-end">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:border-primary/40">
              <Upload className="w-4 h-4" /> {t("changeFile")}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onFileSelect(event.target.files[0]); }} className="hidden" />
            </label>
          </div>
        </motion.div>
      ) : (
        <motion.label
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          animate={{
            scale: primaryDropActive ? 1.02 : 1,
          }}
          whileHover={{
            scale: 1.01,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
          className={`group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed p-6 text-center ${primaryDropActive ? "border-primary bg-primary/10" : "border-white/10 hover:border-primary/40"}`}
        >
          <motion.div
            animate={
              primaryDropActive
                ? { scale: 1.15, rotate: 5, y: 0 }
                : { scale: 1, rotate: 0, y: [0, -4, 0] }
            }
            whileHover={{ scale: 1.1 }}
            transition={
              primaryDropActive
                ? { type: "spring", stiffness: 300, damping: 20 }
                : { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }
            className="mb-4"
          >
            <Upload className="h-8 w-8 text-gray-600 group-hover:text-primary transition-colors" />
          </motion.div>
          <p className="text-sm font-sans text-gray-200">{t("dropImage")}</p>
          <p className="mt-1 text-xs font-sans text-gray-500">{t("chooseFromComputer")}</p>
          <p className="mt-3 text-[10px] text-gray-600">JPG, PNG, WEBP, PDF</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-primary transition-colors group-hover:border-primary/45">
            <Upload className="w-4 h-4" /> {t("chooseFile")}
          </span>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onFileSelect(event.target.files[0]); }} className="hidden" />
        </motion.label>
      )}
    </div>
  );
}
