/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { fadeInUp } from "../lib/animation-variants";
import { useTranslations } from "next-intl";
import { formatCredits } from "@/hooks/use-credits";
import {
  CheckCircle2,
  X,
  ImageOff,
  Download,
  Loader2,
  Save,
  Share2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { ToolConfig } from "../types";
import type { AiStudioJobFeedback } from "@/lib/ai-studio/service";
import type { UseAiStudioResultReturn } from "../hooks/use-ai-studio-result";
import { TOOLS } from "../constants";
import AiStudioWorkflowActions from "./ai-studio-workflow-actions";
import AiStudioBeforeAfterSlider from "./ai-studio-before-after-slider";
import AiStudioQuickRevisionSection from "./ai-studio-quick-revision-section";

interface ImageResultViewerProps {
  // Sub-hook instance for result state + actions
  result: UseAiStudioResultReturn;
  credits: number | null;

  // Visual context
  refImagePreview: string | null;
  visibleTool: ToolConfig | null;

  // Status
  saving: boolean;
  sharing: boolean;
  generating: boolean;

  // Coordination callbacks (page-level orchestration)
  onUseAsPrimary: () => void;
  onRetry: () => void;
  onVariation: () => void;
  onRevise: () => void;
  onReviseWithType: (revisionType: string) => void;
  onReviseWithNote: (note: string) => void;
  onMultiAngle: () => void;
  onAnalyze: () => void;
  onFeedback: (feedback: AiStudioJobFeedback) => void;
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function ImageResultViewer({
  result,
  credits,
  refImagePreview,
  visibleTool,
  saving,
  sharing,
  generating,
  onVariation,
  onRevise,
  onReviseWithType,
  onReviseWithNote,
  onMultiAngle,
  onAnalyze,
}: ImageResultViewerProps) {
  const t = useTranslations("dashboard.aiStudio");
  // Use the tool that actually produced this result (from metadata),
  // not visibleTool which can be stale after tool switch + result restore.
  const resultTool = result.resultMeta?.toolId
    ? TOOLS.find((t) => t.id === result.resultMeta!.toolId) ?? visibleTool
    : visibleTool;
  const vt = {
    color: resultTool?.accentColor || "text-primary",
    bg: resultTool?.accentBg || "bg-primary/10",
    border: resultTool?.accentBorder || "border-primary/20",
  };
  const [imgError, setImgError] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const canCompare = Boolean(refImagePreview && result.resultImage);

  return (
    <>
      <style>{`
        @keyframes completionGlow {
          0% { box-shadow: 0 0 0 0 rgba(198,168,124,0.5), 0 0 0 0 rgba(198,168,124,0.3); }
          40% { box-shadow: 0 0 60px 12px rgba(198,168,124,0.15), 0 0 120px 24px rgba(198,168,124,0.06); }
          100% { box-shadow: 0 0 0 0 rgba(198,168,124,0), 0 0 0 0 rgba(198,168,124,0); }
        }
        .completion-glow {
          animation: completionGlow 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="completion-glow bg-[#0a0c10] border border-white/[0.08] rounded-sm overflow-hidden"
      >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-white/5 ${vt.bg}`}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`w-4 h-4 ${vt.color}`} />
          <p className="text-[11px] font-sans font-bold text-white uppercase tracking-widest">
            {t("imageGenerated")}
          </p>
          {credits !== null && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                {t("creditRemaining", { credits: formatCredits(credits) })}
              </span>
              <span className="text-[8px] font-sans text-gray-600">
                ({credits} işlem hakkı kaldı)
              </span>
            </div>
          )}
        </div>
        <button
          onClick={result.hideResult}
          className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tier 1: Full-size Image — Primary focus */}
      {result.resultImage && (
        <div className="px-4 py-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[8px] text-gray-600 uppercase tracking-widest">
              {t("fullSize")}
            </p>
            {canCompare && (
              <button
                type="button"
                aria-label={t("beforeAfter")}
                aria-pressed={showComparison}
                onClick={() => setShowComparison((current) => !current)}
                className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.18em] transition-all ${
                  showComparison
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-white/[0.08] bg-white/[0.02] text-gray-500 hover:border-primary/25 hover:text-primary/80"
                }`}
              >
                <SlidersHorizontal className="h-3 w-3" />
                Karşılaştır
              </button>
            )}
          </div>
          <div className="relative overflow-hidden rounded-sm border border-white/10 bg-gradient-to-b from-black/40 to-black/20 flex items-center justify-center">
            {/* Architectural grid watermark */}
            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(198, 168, 124, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(198, 168, 124, 0.2) 1px, transparent 1px)",
                backgroundSize: "80px 80px",
              }}
            />
            <div className="relative w-full h-[300px] md:h-[420px] xl:h-[560px] flex items-center justify-center p-4">
              {imgError ? (
                <div className="flex h-full w-full items-center justify-center text-red-400 text-[10px]">
                  <ImageOff className="w-5 h-5 mr-2" />{" "}
                  {t("imageLoadFailed")}
                </div>
              ) : isExternalUrl(result.resultImage.src) ? (
                <Image
                  src={result.resultImage.src}
                  alt={t("resultAlt")}
                  fill
                  className="object-contain p-2"
                  unoptimized
                  onError={() => setImgError(true)}
                />
              ) : (
                <img
                  src={result.resultImage.src}
                  alt={t("resultAlt")}
                  className="max-h-full max-w-full object-contain"
                  onError={() => setImgError(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {canCompare && showComparison && refImagePreview && result.resultImage && (
          <motion.div
            key="comparison"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -8 }}
          >
            <AiStudioBeforeAfterSlider
              refImagePreview={refImagePreview}
              resultImage={result.resultImage}
              compareSplit={result.compareSplit}
              onCompareSplitChange={result.setCompareSplit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tier 2: Quick actions — minimal result controls */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-3 gap-1.5 rounded-sm border border-white/[0.06] bg-white/[0.015] p-1.5">
          <button
            onClick={() => void result.handleDownloadCurrentResult()}
            className={`flex items-center justify-center gap-1.5 rounded-sm px-2 py-2 text-[8px] font-bold uppercase tracking-[0.16em] transition-all ${vt.bg} border ${vt.border} ${vt.color} hover:opacity-80`}
          >
            <Download className="h-3 w-3" />
            {t("download")}
          </button>
          <button
            onClick={() => void result.handleSaveResultToProject()}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-sm border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[8px] font-bold uppercase tracking-[0.16em] text-gray-400 transition-all hover:border-primary/30 hover:text-gray-200 disabled:opacity-45"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {t("saveToProject")}
          </button>
          <button
            onClick={() => void result.handleNativeShare()}
            disabled={sharing}
            className="flex items-center justify-center gap-1.5 rounded-sm border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[8px] font-bold uppercase tracking-[0.16em] text-gray-400 transition-all hover:border-primary/30 hover:text-gray-200 disabled:opacity-45"
          >
            {sharing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
            {t("share")}
          </button>
        </div>
      </div>

      {/* Tier 3: Workflow continuation */}
      <AiStudioWorkflowActions
        onRevise={onRevise}
        onVariation={onVariation}
        onMultiAngle={onMultiAngle}
        onAnalyze={onAnalyze}
        generating={generating}
      />

      {/* Quick revision details */}
      <AiStudioQuickRevisionSection
        onReviseWithType={onReviseWithType}
        onReviseWithNote={onReviseWithNote}
        generating={generating}
      />
    </motion.div>
    </>
  );
}
