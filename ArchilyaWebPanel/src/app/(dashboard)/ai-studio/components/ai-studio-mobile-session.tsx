"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Clock, Eye, History, X, Sparkles, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { TOOLS } from "../constants";
import { fadeIn, fastTransition, snapTransition } from "../lib/animation-variants";
import type { PromptHistoryEntry } from "../types";

interface AiStudioMobileSessionProps {
  promptHistoryByTool: Record<string, PromptHistoryEntry[]>;
  hasHiddenResult: boolean;
  lastResultToolLabel: string | null;
  activeJobId: string | null;
  resultImage: { src: string; mimeType: string } | null;
  resultText: string | null;
  onApplyPromptHistory: (entry: PromptHistoryEntry) => void;
  onRestoreLastResult: () => void;
}

const slideUp: Variants = {
  hidden: { y: 500, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: snapTransition },
  exit: { y: 500, opacity: 0, transition: fastTransition },
};

function formatHistoryDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPromptPreview(entry: PromptHistoryEntry) {
  return entry.extraNote || entry.statusLabel || entry.style || entry.toolLabel;
}

export default function AiStudioMobileSession({
  promptHistoryByTool,
  hasHiddenResult,
  lastResultToolLabel,
  activeJobId,
  resultImage,
  resultText,
  onApplyPromptHistory,
  onRestoreLastResult,
}: AiStudioMobileSessionProps) {
  const t = useTranslations("dashboard.aiStudio");
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const allEntries = Object.values(promptHistoryByTool)
    .flat()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentEntries = allEntries.slice(0, 5);
  const promptCount = allEntries.length;
  const hasResultPreview = Boolean(resultImage || resultText);
  const sessionToolLabel = lastResultToolLabel || recentEntries[0]?.toolLabel || null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border border-amber-300/15 bg-[#1a1c23] shadow-[0_0_18px_rgba(245,158,11,0.06)] transition-colors hover:bg-[#22242b]"
        aria-label={t("sessionLastJob")}
      >
        <Clock className="w-4.5 h-4.5 text-amber-300/70" />
        {hasHiddenResult && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#0a0c10] bg-amber-400">
            <Eye className="w-2.5 h-2.5 text-black" />
          </span>
        )}
        {promptCount > 0 && (
          <span className="absolute -right-0.5 -bottom-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#0a0c10] bg-white/[0.08] px-0.5 text-[7px] font-bold text-gray-400">
            {promptCount > 9 ? "9+" : promptCount}
          </span>
        )}
      </button>

      {/* Overlay + Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="mobile-session-overlay"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm xl:hidden"
            />

            <motion.div
              key="mobile-session-sheet"
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-0 left-0 right-0 z-[100] xl:hidden bg-[#0a0c10] border-t border-white/[0.06] rounded-t-xl max-h-[60vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="sticky top-0 z-10 bg-[#0a0c10] border-b border-white/[0.06]">
                <div className="flex justify-center pt-2">
                  <span className="h-1 w-11 rounded-full bg-white/15" aria-hidden="true" />
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-300/70" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {t("sessionLastJob")}
                    </span>
                    <span className="rounded-sm border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[8px] font-bold text-primary">
                      {t("sessionCount", { count: promptCount })}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Hidden result restore */}
                {hasHiddenResult && (
                  <div className="rounded-sm border border-amber-300/15 bg-amber-400/8 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-3.5 h-3.5 text-amber-300" />
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">
                        {t("sessionHiddenResult")}
                      </p>
                    </div>
                    <p className="text-[9px] text-gray-400 mb-2.5">
                      {t("hiddenResultAvailable")}
                    </p>
                    <button
                      onClick={() => {
                        onRestoreLastResult();
                        setIsOpen(false);
                      }}
                      className="w-full rounded-sm border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300 transition-all active:scale-[0.97]"
                    >
                      {t("sessionRestore")}
                    </button>
                  </div>
                )}

                {/* Last result preview */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                      {t("sessionLastJob")}
                    </p>
                    {activeJobId && (
                      <span className="rounded-sm border border-white/[0.06] px-2 py-0.5 text-[8px] font-mono text-gray-600">
                        #{activeJobId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {hasResultPreview ? (
                    <div className="flex items-center gap-3 rounded-sm border border-white/[0.06] bg-white/[0.02] p-2.5">
                      {resultImage ? (
                        <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded-sm border border-white/[0.06] bg-[#0f1115]">
                          <img src={resultImage.src} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-sm border border-white/[0.06] bg-[#0f1115]">
                          <History className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-bold text-gray-300">
                          {sessionToolLabel || t("visualOutput")}
                        </p>
                        {resultText && (
                          <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-gray-500">
                            {resultText}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-sm border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[10px] text-gray-600">
                      {t("sessionEmpty")}
                    </p>
                  )}
                </div>

                {/* Prompt history */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History className="h-3 w-3 text-primary/60" />
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                      {t("sessionPromptHistory")}
                    </p>
                  </div>
                  {recentEntries.length > 0 ? (
                    <div className="space-y-1.5">
                      {recentEntries.map((entry) => {
                        const tool = TOOLS.find((item) => item.id === entry.toolId);
                        const ToolIcon = tool?.icon || History;
                        const preview = getPromptPreview(entry);
                        return (
                          <button
                            key={entry.id}
                            onClick={() => {
                              onApplyPromptHistory(entry);
                              setIsOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-sm border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition-all active:scale-[0.98]"
                          >
                            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm border ${tool?.accentBg || "bg-white/[0.03]"} ${tool?.accentBorder || "border-white/[0.06]"}`}>
                              <ToolIcon className={`h-3.5 w-3.5 ${tool?.accentColor || "text-gray-500"}`} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[10px] font-semibold text-gray-300">
                                {preview}
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-[8px] text-gray-600">
                                <Clock className="h-2.5 w-2.5" />
                                {formatHistoryDate(entry.createdAt, locale)}
                              </span>
                            </span>
                            <ChevronRight className="w-3 h-3 text-gray-700" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-sm border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[10px] text-gray-600">
                      {t("sessionPromptEmpty")}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
