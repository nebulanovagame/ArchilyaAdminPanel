/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  X,
  Download,
  Save,
  Share2,
  RotateCw,
  RefreshCcw,
  WandSparkles,
  Undo2,
  Redo2,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  ImageOff,
} from "lucide-react";
import type { ResultImage } from "../types";
import type { AiStudioJobFeedback } from "@/lib/ai-studio/service";

interface ImageResultViewerProps {
  resultImage: ResultImage;
  refImagePreview: string | null;
  compareSplit: number;
  onCompareSplitChange: (value: number) => void;
  visibleTool: {
    color: string;
    bg: string;
    border: string;
    label: string;
  } | null;
  onDownload: () => void;
  onSave: () => void;
  onShare: () => void;
  onUseAsPrimary: () => void;
  onRetry: () => void;
  onVariation: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  sharing: boolean;
  generating: boolean;
  feedback: AiStudioJobFeedback;
  onFeedback: (feedback: AiStudioJobFeedback) => void;
  onClose: () => void;
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function ImageResultViewer({
  resultImage,
  refImagePreview,
  compareSplit,
  onCompareSplitChange,
  visibleTool,
  onDownload,
  onSave,
  onShare,
  onUseAsPrimary,
  onRetry,
  onVariation,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saving,
  sharing,
  generating,
  feedback,
  onFeedback,
  onClose,
}: ImageResultViewerProps) {
  const t = useTranslations("dashboard.aiStudio");
  const vt = visibleTool || { color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", label: "" };
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`bg-[#0d0f13] border rounded-sm overflow-hidden ${vt.border}`}>
      <div className={`flex items-center justify-between px-5 py-3 border-b border-white/5 ${vt.bg}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 ${vt.color}`} />
          <p className="text-xs font-sans font-bold text-white uppercase tracking-widest">{t("imageGenerated")}</p>
          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${vt.bg} ${vt.border} ${vt.color}`}>Archilya AI Core</span>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {refImagePreview && (
        <div className="border-b border-white/5 p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest">{t("beforeAfter")}</p>
            <span className="text-[10px] text-gray-500">{t("resultPercent", { percent: compareSplit })}</span>
          </div>
          <div className="relative h-[320px] w-full overflow-hidden rounded-sm border border-white/10 bg-black/30 md:h-[420px]">
            <img src={refImagePreview} alt={t("originalAlt")} className="h-full w-full object-contain" />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}>
              {imgError ? (
                <div className="flex h-full w-full items-center justify-center text-red-400 text-xs">
                  <ImageOff className="w-6 h-6 mr-2" /> {t("imageLoadFailed")}
                </div>
              ) : isExternalUrl(resultImage.src) ? (
                <Image src={resultImage.src} alt={t("resultAlt")} fill className="object-contain" unoptimized onError={() => setImgError(true)} />
              ) : (
                <img src={resultImage.src} alt={t("resultAlt")} className="h-full w-full object-contain" onError={() => setImgError(true)} />
              )}
            </div>
            <div className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${compareSplit}%` }} />
          </div>
          <input type="range" min="0" max="100" value={compareSplit} onChange={(event) => onCompareSplitChange(Number(event.target.value))} className="w-full mt-3 accent-primary" />
        </div>
      )}

      <div className="px-4 pb-2 md:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest">{t("fullSize")}</p>
        </div>
        <div className="relative overflow-hidden rounded-sm border border-white/10 bg-black/20">
          <div className="relative h-[320px] w-full md:h-[460px] xl:h-[620px]">
            {imgError ? (
              <div className="flex h-full w-full items-center justify-center text-red-400 text-xs">
                <ImageOff className="w-6 h-6 mr-2" /> {t("imageLoadFailed")}
              </div>
            ) : isExternalUrl(resultImage.src) ? (
              <Image src={resultImage.src} alt={t("resultAlt")} fill className="object-contain" unoptimized onError={() => setImgError(true)} />
            ) : (
              <img src={resultImage.src} alt={t("resultAlt")} className="h-full w-full object-contain" onError={() => setImgError(true)} />
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <button onClick={() => void onDownload()} className={`flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all ${vt.bg} border ${vt.border} ${vt.color} hover:opacity-80`}>
            <Download className="w-4 h-4" /> {t("download")}
          </button>
          <button onClick={() => void onSave()} disabled={saving} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("saveToProject")}
          </button>
          <button onClick={() => void onShare()} disabled={sharing} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 disabled:opacity-50">
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} {t("share")}
          </button>
          <button onClick={onUseAsPrimary} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40">
            <RotateCw className="w-4 h-4" /> {t("makePrimaryScene")}
          </button>
          <button onClick={() => void onRetry()} disabled={generating} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 disabled:opacity-50">
            <RefreshCcw className="w-4 h-4" /> {t("regenerate")}
          </button>
          <button onClick={onVariation} disabled={generating} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 disabled:opacity-50">
            <WandSparkles className="w-4 h-4" /> {t("variation")}
          </button>
          <button onClick={onUndo} disabled={!canUndo} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 disabled:opacity-40">
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="flex items-center justify-center gap-2 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-200 hover:border-primary/40 disabled:opacity-40">
            <Redo2 className="w-4 h-4" /> Redo
          </button>
        </div>
        <div className="px-3 py-2 rounded-sm border border-white/10 bg-white/[0.02] text-[11px] text-gray-400">
          {t("shareSecurity")}
        </div>

        {/* Feedback */}
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/5">
          <span className="text-[10px] text-gray-500 font-sans">{t("feedbackQuestion")}</span>
          <button
            onClick={() => onFeedback(feedback === "positive" ? null : "positive")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium transition-all ${
              feedback === "positive"
                ? "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-emerald-400 hover:border-emerald-400/20"
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" /> {t("positiveFeedback")}
          </button>
          <button
            onClick={() => onFeedback(feedback === "negative" ? null : "negative")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium transition-all ${
              feedback === "negative"
                ? "bg-red-400/10 border border-red-400/30 text-red-400"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-400/20"
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" /> {t("negativeFeedback")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
