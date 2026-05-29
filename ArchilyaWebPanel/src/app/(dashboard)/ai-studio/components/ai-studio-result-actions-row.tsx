"use client";

import { useTranslations } from "next-intl";
import {
  Download,
  Loader2,
  RefreshCcw,
  RotateCw,
  Save,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from "lucide-react";

import type { AiStudioJobFeedback } from "@/lib/ai-studio/service";
import type { UseAiStudioResultReturn } from "../hooks/use-ai-studio-result";
import type { ToolConfig } from "../types";

interface AiStudioResultActionsRowProps {
  result: UseAiStudioResultReturn;
  saving: boolean;
  sharing: boolean;
  generating: boolean;
  feedback: AiStudioJobFeedback;
  visibleTool: ToolConfig | null;
  onUseAsPrimary: () => void;
  onRetry: () => void;
  onFeedback: (feedback: AiStudioJobFeedback) => void;
}

export default function AiStudioResultActionsRow({
  result,
  saving,
  sharing,
  generating,
  feedback,
  visibleTool,
  onUseAsPrimary,
  onRetry,
  onFeedback,
}: AiStudioResultActionsRowProps) {
  const t = useTranslations("dashboard.aiStudio");
  const vt = {
    color: visibleTool?.accentColor || "text-primary",
    bg: visibleTool?.accentBg || "bg-primary/10",
    border: visibleTool?.accentBorder || "border-primary/20",
  };

  return (
    <>
      {/* Action Buttons Row */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 md:gap-1.5">
          <button
            onClick={() => void result.handleDownloadCurrentResult()}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-sm text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all ${vt.bg} border ${vt.border} ${vt.color} hover:opacity-80`}
          >
            <Download className="w-3 h-3" /> {t("download")}
          </button>
          <button
            onClick={() => void result.handleSaveResultToProject()}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-400 hover:border-primary/40 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}{" "}
            {t("saveToProject")}
          </button>
          <button
            onClick={() => void result.handleNativeShare()}
            disabled={sharing}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-400 hover:border-primary/40 disabled:opacity-50"
          >
            {sharing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Share2 className="w-3 h-3" />
            )}{" "}
            {t("share")}
          </button>
          <button
            onClick={onUseAsPrimary}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-400 hover:border-primary/40"
          >
            <RotateCw className="w-3 h-3" /> {t("makePrimaryScene")}
          </button>
          <button
            onClick={() => void onRetry()}
            disabled={generating}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-400 hover:border-primary/40 disabled:opacity-50"
          >
            <RefreshCcw className="w-3 h-3" /> {t("regenerate")}
          </button>
          <button
            onClick={result.handleUndo}
            disabled={!result.canUndoRevision}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-gray-400 hover:border-primary/40 disabled:opacity-40"
          >
            <Undo2 className="w-3 h-3" /> {t("undo")}
          </button>
        </div>
      </div>

      {/* Feedback */}
      <div className="mx-4 mb-3 flex items-center justify-center gap-3 px-3 py-2 rounded-sm border border-white/5 bg-white/[0.01]">
        <span className="text-[9px] text-gray-600 font-sans">
          {t("feedbackQuestion")}
        </span>
        <button
          onClick={() =>
            onFeedback(feedback === "positive" ? null : "positive")
          }
          className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[9px] font-medium transition-all ${
            feedback === "positive"
              ? "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
              : "bg-white/5 border border-white/10 text-gray-500 hover:text-emerald-400 hover:border-emerald-400/20"
          }`}
        >
          <ThumbsUp className="w-3 h-3" /> {t("positiveFeedback")}
        </button>
        <button
          onClick={() =>
            onFeedback(feedback === "negative" ? null : "negative")
          }
          className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[9px] font-medium transition-all ${
            feedback === "negative"
              ? "bg-red-400/10 border border-red-400/30 text-red-400"
              : "bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-400/20"
          }`}
        >
          <ThumbsDown className="w-3 h-3" /> {t("negativeFeedback")}
        </button>
      </div>
    </>
  );
}
