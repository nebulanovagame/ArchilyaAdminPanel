"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Clock, Eye, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { TOOLS } from "../constants";
import { buttonTap, expandCollapse, fadeInDown, listItem } from "../lib/animation-variants";
import type { PromptHistoryEntry } from "../types";

interface AiStudioSessionPanelProps {
  promptHistoryByTool: Record<string, PromptHistoryEntry[]>;
  hasHiddenResult: boolean;
  lastResultToolLabel: string | null;
  activeJobId: string | null;
  resultImage: { src: string; mimeType: string } | null;
  resultText: string | null;
  onApplyPromptHistory: (entry: PromptHistoryEntry) => void;
  onRestoreLastResult: () => void;
}

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

export default function AiStudioSessionPanel({
  promptHistoryByTool,
  hasHiddenResult,
  lastResultToolLabel,
  activeJobId,
  resultImage,
  resultText,
  onApplyPromptHistory,
  onRestoreLastResult,
}: AiStudioSessionPanelProps) {
  const t = useTranslations("dashboard.aiStudio");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const promptEntries = useMemo(
    () =>
      Object.values(promptHistoryByTool)
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [promptHistoryByTool],
  );

  const recentPromptEntries = promptEntries.slice(0, 4);
  const promptCount = promptEntries.length;
  const hasResultPreview = Boolean(resultImage || resultText);
  const sessionToolLabel = lastResultToolLabel || recentPromptEntries[0]?.toolLabel || null;

  return (
    <motion.section
      variants={fadeInDown}
      initial="hidden"
      animate="visible"
      className="rounded-sm border border-white/[0.06] bg-[#0a0c10]/95 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
    >
      <motion.button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.025]"
        aria-expanded={expanded}
        {...buttonTap}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-primary/15 bg-primary/8 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-primary">
              <Clock className="h-2.5 w-2.5" />
              {t("sessionLastJob")}
            </span>
            {hasHiddenResult && (
              <span className="rounded-sm border border-amber-300/15 bg-amber-400/8 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-amber-300">
                {t("sessionHiddenResult")}
              </span>
            )}
          </div>
          <p className="truncate text-[10px] font-sans text-gray-400">
            {sessionToolLabel ? t("sessionCollapsed", { tool: sessionToolLabel }) : t("sessionEmpty")}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="rounded-sm border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] font-bold text-gray-500">
            {t("sessionCount", { count: promptCount })}
          </span>
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="space-y-4 p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
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
                        <img src={resultImage.src} alt={t("sessionLastResultPreview")} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-sm border border-white/[0.06] bg-[#0f1115]">
                        <History className="h-4 w-4 text-gray-600" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold text-gray-300">
                        {lastResultToolLabel || t("visualOutput")}
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

                {hasHiddenResult && (
                  <motion.button
                    type="button"
                    onClick={onRestoreLastResult}
                    className="flex w-full items-center justify-center gap-2 rounded-sm border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300 transition-all hover:border-amber-300/35 hover:bg-amber-400/15"
                    {...buttonTap}
                  >
                    <Eye className="h-3 w-3" />
                    {t("sessionRestore")}
                  </motion.button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-3 w-3 text-primary/60" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    {t("sessionPromptHistory")}
                  </p>
                </div>

                {recentPromptEntries.length > 0 ? (
                  <div className="space-y-1.5">
                    {recentPromptEntries.map((entry, index) => {
                      const tool = TOOLS.find((item) => item.id === entry.toolId);
                      const ToolIcon = tool?.icon || History;
                      const promptPreview = getPromptPreview(entry);

                      return (
                        <motion.button
                          key={entry.id}
                          type="button"
                          variants={listItem(index)}
                          initial="hidden"
                          animate="visible"
                          onClick={() => onApplyPromptHistory(entry)}
                          className="flex w-full items-center gap-2 rounded-sm border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition-all hover:border-primary/20 hover:bg-primary/[0.04]"
                        >
                          <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm border ${tool?.accentBg || "bg-white/[0.03]"} ${tool?.accentBorder || "border-white/[0.06]"}`}>
                            <ToolIcon className={`h-3.5 w-3.5 ${tool?.accentColor || "text-gray-500"}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10px] font-semibold text-gray-300">
                              {promptPreview}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[8px] text-gray-600">
                              <Clock className="h-2.5 w-2.5" />
                              {formatHistoryDate(entry.createdAt, locale)}
                            </span>
                          </span>
                        </motion.button>
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
        )}
      </AnimatePresence>
    </motion.section>
  );
}
