"use client";

import { useTranslations } from "next-intl";
import type { PromptHistoryEntry } from "../types";

interface PromptHistoryListProps {
  entries: PromptHistoryEntry[];
  onApply: (entry: PromptHistoryEntry) => void;
}

export default function PromptHistoryList({ entries, onApply }: PromptHistoryListProps) {
  const t = useTranslations("dashboard.aiStudio");

  if (entries.length === 0) return null;

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t("promptHistory")}</p>
        <span className="text-[10px] text-gray-700">{t("recordCount", { count: entries.length })}</span>
      </div>
      <div className="space-y-2">
        {entries.slice(0, 4).map((entry) => (
          <button
            key={entry.id}
            onClick={() => onApply(entry)}
            className="w-full text-left rounded-sm border border-white/10 bg-white/[0.02] px-3 py-3 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-sans text-white truncate">{entry.statusLabel || entry.toolLabel}</p>
              <span className="text-[10px] text-gray-600 flex-shrink-0">{new Date(entry.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</span>
            </div>
            {entry.extraNote && <p className="mt-1 text-[10px] text-gray-500 truncate">{entry.extraNote}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
