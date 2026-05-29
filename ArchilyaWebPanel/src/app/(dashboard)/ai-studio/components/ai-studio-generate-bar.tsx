"use client";

import { Sparkles, Loader2, AlertCircle, ChevronRight, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ToolConfig } from "../types";

interface AiStudioGenerateBarProps {
  selectedTool: ToolConfig;
  canGenerate: boolean;
  generating: boolean;
  credits: number | null;
  hasEnoughCredits: (amount: number) => boolean;
  onGenerate: () => void;
  /** Visual variant: "panel" for right sidebar, "mobile" for sticky bottom bar */
  variant?: "panel" | "mobile";
}

export default function AiStudioGenerateBar({
  selectedTool,
  canGenerate,
  generating,
  credits,
  hasEnoughCredits,
  onGenerate,
  variant = "panel",
}: AiStudioGenerateBarProps) {
  const t = useTranslations("dashboard.aiStudio");

  if (variant === "mobile") {
    return (
      <>
        {!generating ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-sm ${selectedTool.accentBg} border ${selectedTool.accentBorder} flex items-center justify-center flex-shrink-0`}
                >
                  <selectedTool.icon
                    className={`w-3 h-3 ${selectedTool.accentColor}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-sans truncate">
                  {selectedTool.credit} {t("creditUnit")}
                </span>
              </div>
              <button
                onClick={onGenerate}
                disabled={!canGenerate}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all duration-200 flex-shrink-0 ${
                  canGenerate
                    ? `${selectedTool.accentBg} border ${selectedTool.accentBorder} ${selectedTool.accentColor}`
                    : "bg-white/[0.02] border border-white/[0.06] text-gray-600 cursor-not-allowed"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {selectedTool.outputType === "image"
                  ? t("generateButton", { credit: selectedTool.credit })
                  : t("analyzeButton", { credit: selectedTool.credit })}
              </button>
            </div>
            {credits !== null && (
              <div className="flex items-center gap-1 text-[8px] text-gray-600">
                <span>{t("creditBalanceLabel", { balance: credits.toLocaleString("tr-TR") })}</span>
                <span className="relative group cursor-help" title={t("creditInfoTooltip")}>
                  <Info className="w-2 h-2 text-gray-700 group-hover:text-gray-500 transition-colors" />
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-[10px] text-gray-400 font-sans">
              {selectedTool.outputType === "image"
                ? t("imageQueued")
                : t("analysisQueued")}
            </span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className={`relative w-full flex items-center justify-center gap-2.5 py-3.5 rounded-sm text-[11px] font-bold uppercase tracking-widest transition-all duration-200 ${
          generating
            ? "bg-white/5 text-gray-600 cursor-not-allowed"
            : canGenerate
              ? `${selectedTool.accentBg} border ${selectedTool.accentBorder} ${selectedTool.accentColor} shadow-[0_0_20px_rgba(198,168,124,0.15)] hover:opacity-85 active:scale-[0.97]`
              : "bg-white/[0.02] border border-white/[0.06] text-gray-600 cursor-not-allowed"
         } active:scale-[0.97]`}
      >
        {generating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {selectedTool.outputType === "image"
              ? t("imageQueued")
              : t("analysisQueued")}
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            {selectedTool.outputType === "image"
              ? t("generateButton", { credit: selectedTool.credit })
              : t("analyzeButton", { credit: selectedTool.credit })}
          </>
        )}
        {canGenerate && !generating && (
          <motion.span
            className="pointer-events-none absolute -inset-0.5 rounded-sm border border-primary/20"
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
        )}
      </button>

      {!hasEnoughCredits(selectedTool.credit) && credits !== null && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-red-400/4 border border-l-2 border-l-red-400/25 border-red-400/10 rounded-sm text-[10px] text-red-300 font-sans">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {t("creditRequired", {
                  required: selectedTool.credit,
                  available: credits.toLocaleString("tr-TR"),
                })}
              </span>
            </div>
            <p className="text-red-200/80">
              Bu işlem için yeterli işlem hakkınız yok.
            </p>
          </div>
          <Link
            href="/abonelik"
            className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary rounded-sm hover:bg-primary/15 transition-colors flex-shrink-0"
          >
            {`Planını yükselt · ${selectedTool.credit} işlem hakkı kazan`}
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
