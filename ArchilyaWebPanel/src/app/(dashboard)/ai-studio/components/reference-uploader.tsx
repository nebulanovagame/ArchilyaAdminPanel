/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, X, FileText, ImageOff } from "lucide-react";
import { scaleIn } from "../lib/animation-variants";
import { useTranslations } from "next-intl";

const TOOL_UPLOAD_HINTS: Record<string, string> = {
  img2img: "Sketchup ekran görüntünüzü yükleyin",
  enhance: "Referans stil uygulamak için bir görsel yükleyin",
  sceneedit: "Revize edilecek ana görseli yükleyin",
  "multi-angle": "Yeni açı oluşturulacak görseli yükleyin",
  analysis: "Analiz edilecek görseli yükleyin",
  plancolor: "Boyanacak kat planı görselini yükleyin",
};

interface ReferenceUploaderProps {
  refImageFile: File | null;
  refImagePreview: string | null;
  primaryDropActive: boolean;
  toolId?: string;
  toolLabel?: string;
  toolUploadHint?: string;
  isProcessing?: boolean;
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
  toolId,
  toolLabel,
  toolUploadHint,
  isProcessing = false,
  fileInputRef,
  onFileSelect,
  onClear,
  onDrop,
  onDragOver,
  onDragLeave,
}: ReferenceUploaderProps) {
  const t = useTranslations("dashboard.aiStudio");
  const [imgError, setImgError] = useState(false);

  // Reset error state when the preview URL changes (new upload)
  useEffect(() => {
    const id = setTimeout(() => setImgError(false), 0);
    return () => clearTimeout(id);
  }, [refImagePreview]);

  const resolvedToolUploadHint =
    toolUploadHint || (toolId ? TOOL_UPLOAD_HINTS[toolId] : undefined) || (toolLabel ? `${toolLabel} için bir görsel yükleyin.` : undefined);

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-serif text-white italic">{t("uploadTitle")}</p>
          <p className="mt-1 text-[11px] text-gray-500">{t("uploadSubtitle")}</p>
        </div>
      </div>

      {toolLabel && !refImageFile && (
        <p className="mb-2 px-1 text-[10px] font-sans text-gray-600">
          {resolvedToolUploadHint}
        </p>
      )}

      {refImagePreview ? (
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-sm border border-white/10 bg-black/20"
        >
          <div className="relative h-[260px] w-full md:h-[360px]">
            {imgError ? (
              <div className="flex h-full w-full items-center justify-center gap-2 text-red-400/70 text-[10px]">
                <ImageOff className="w-5 h-5" />
                {t("imageLoadFailed")}
              </div>
            ) : (
              <img
                src={refImagePreview}
                alt={t("referenceAlt")}
                className="h-full w-full object-contain"
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <div className="absolute top-3 left-3 rounded-sm border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gray-200">{t("referenceReady")}</div>
          <div className="absolute right-3 top-3">
            <button onClick={onClear} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-black/70 text-gray-300 hover:border-white/20 hover:text-white transition-colors active:scale-[0.95] focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] text-gray-200">{refImageFile?.name || t("sampleReference")}</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none">
              <Upload className="w-4 h-4" /> {t("changeFile")}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onFileSelect(event.target.files[0]); }} className="hidden" />
            </label>
          </div>
        </motion.div>
      ) : refImageFile ? (
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
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
            <button onClick={onClear} className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-black/40 text-gray-300 hover:border-white/20 hover:text-white transition-colors flex-shrink-0 active:scale-[0.95] focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-end">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:border-primary/40">
              <Upload className="w-4 h-4" /> {t("changeFile")}
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onFileSelect(event.target.files[0]); }} className="hidden" />
            </label>
          </div>
          {isProcessing && refImageFile && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-sm border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-sans text-gray-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              İşleniyor...
            </div>
          )}
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
          className={`group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed p-8 text-center overflow-hidden ${
            primaryDropActive 
              ? "border-primary/50 bg-primary/[0.06]" 
              : "border-white/[0.08] hover:border-primary/30 bg-white/[0.01]"
          }`}
        >
          {/* Glass overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          
          {/* Architectural grid background */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(198, 168, 124, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(198, 168, 124, 0.3) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

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
            className="relative z-10 mb-5"
          >
            <div className="w-14 h-14 rounded-sm bg-primary/5 border border-primary/20 flex items-center justify-center group-hover:bg-primary/10 transition-all duration-300">
              <Upload className="h-7 w-7 text-primary/50 group-hover:text-primary/70 transition-colors" />
            </div>
          </motion.div>
          <p className="relative z-10 text-base font-serif text-white/80 italic">{t("dropImage")}</p>
          <p className="relative z-10 mt-1.5 text-xs font-sans text-gray-500">{t("chooseFromComputer")}</p>
          <div className="relative z-10 mt-4 flex items-center gap-3">
            <span className="text-[9px] text-gray-600 font-sans">JPG</span>
            <span className="w-px h-3 bg-white/[0.06]" />
            <span className="text-[9px] text-gray-600 font-sans">PNG</span>
            <span className="w-px h-3 bg-white/[0.06]" />
            <span className="text-[9px] text-gray-600 font-sans">WEBP</span>
            <span className="w-px h-3 bg-white/[0.06]" />
            <span className="text-[9px] text-gray-600 font-sans">PDF</span>
          </div>
          <span className="relative z-10 mt-6 inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-primary/10 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-primary transition-all group-hover:bg-primary/15 group-hover:border-primary/45">
            <Upload className="w-4 h-4" /> {t("chooseFile")}
          </span>
          {/* Subtle corner accents */}
          <div className="absolute top-0 left-0 w-6 h-px bg-gradient-to-r from-primary/30 to-transparent" />
          <div className="absolute top-0 left-0 w-px h-6 bg-gradient-to-b from-primary/30 to-transparent" />
          <div className="absolute bottom-0 right-0 w-6 h-px bg-gradient-to-l from-primary/30 to-transparent" />
          <div className="absolute bottom-0 right-0 w-px h-6 bg-gradient-to-t from-primary/30 to-transparent" />
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onFileSelect(event.target.files[0]); }} className="hidden" />
        </motion.label>
      )}
    </div>
  );
}
