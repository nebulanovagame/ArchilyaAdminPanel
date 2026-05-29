"use client";

import { useTranslations } from "next-intl";
import {
  FileEdit,
  WandSparkles,
  SplitSquareHorizontal,
  ScanLine,
  ArrowRight,
} from "lucide-react";

interface AiStudioWorkflowActionsProps {
  onRevise: () => void;
  onVariation: () => void;
  onMultiAngle: () => void;
  onAnalyze: () => void;
  generating: boolean;
}

export default function AiStudioWorkflowActions({
  onRevise,
  onVariation,
  onMultiAngle,
  onAnalyze,
  generating,
}: AiStudioWorkflowActionsProps) {
  const t = useTranslations("dashboard.aiStudio");

  return (
    <div className="px-4 pb-3">
      <div className="rounded-sm border border-white/[0.06] bg-[#0a0c10] p-4">
        {/* Next step highlight */}
        <div className="mb-4 rounded-sm border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.08] via-cyan-300/[0.035] to-transparent p-3 shadow-[0_0_28px_rgba(103,232,249,0.08)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-cyan-200/70">
              Sıradaki Adım
            </p>
            <span className="h-px flex-1 bg-gradient-to-r from-cyan-300/20 to-transparent" />
          </div>
          <p className="mb-2 text-[10px] leading-relaxed text-gray-400">
            Bu sonuçtan devam edebilirsiniz:
          </p>
          <button
            onClick={onRevise}
            disabled={generating}
            className="group flex w-full items-center gap-3 rounded-sm border border-cyan-200/25 bg-cyan-200/[0.07] px-4 py-3 text-left transition-all duration-200 hover:border-cyan-200/45 hover:bg-cyan-200/[0.1] hover:shadow-[0_0_24px_rgba(103,232,249,0.12)] hover:-translate-y-[0.5px] active:scale-[0.98] disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-cyan-300/45 focus-visible:outline-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-cyan-200/20 bg-cyan-200/[0.08] transition-colors group-hover:bg-cyan-200/[0.12]">
              <FileEdit className="h-4 w-4 text-cyan-100" />
            </div>
            <div className="flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                Bu render&apos;ı revize et
              </span>
              <span className="mt-0.5 block text-[8px] text-cyan-200/55">
                {t("reviseActionHint")}
              </span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-cyan-200/50 transition-colors group-hover:text-cyan-100" />
          </button>
        </div>

        {/* Tier 1: PRIMARY workflow continuation */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-cyan-300/70" />
            <span className="h-1 w-1 rounded-full bg-cyan-300/35" />
          </div>
          <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans">
            İş Akışını Devam Ettir
          </p>
          <span className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
        </div>
        <div className="mb-5 flex flex-col gap-3">
          <button
            onClick={onRevise}
            disabled={generating}
            className="group flex items-center gap-3 rounded-sm border border-cyan-300/18 border-l-2 border-l-transparent bg-cyan-300/[0.04] px-4 py-3.5 text-left transition-all duration-200 hover:border-cyan-300/30 hover:border-l-cyan-300/50 hover:bg-cyan-300/[0.07] hover:shadow-sm hover:-translate-y-[0.5px] active:scale-[0.98] disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-cyan-300/40 focus-visible:outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-cyan-300/18 bg-cyan-300/[0.06] group-hover:bg-cyan-300/[0.1] transition-colors">
              <FileEdit className="h-4 w-4 text-cyan-200" />
            </div>
            <div className="flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
                {t("reviseAction")}
              </span>
              <span className="block text-[8px] text-cyan-300/50 mt-0.5">
                {t("reviseActionHint")}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-cyan-300/40 transition-colors group-hover:text-cyan-300/70" />
          </button>
          <button
            onClick={onMultiAngle}
            disabled={generating}
            className="group flex items-center gap-3 rounded-sm border border-sky-300/18 border-l-2 border-l-transparent bg-sky-300/[0.04] px-4 py-3.5 text-left transition-all duration-200 hover:border-sky-300/30 hover:border-l-sky-300/50 hover:bg-sky-300/[0.07] hover:shadow-sm hover:-translate-y-[0.5px] active:scale-[0.98] disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-sky-300/40 focus-visible:outline-none"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-sky-300/18 bg-sky-300/[0.06] group-hover:bg-sky-300/[0.1] transition-colors">
              <SplitSquareHorizontal className="h-4 w-4 text-sky-200" />
            </div>
            <div className="flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/90">
                {t("multiAngleAction")}
              </span>
              <span className="block text-[8px] text-sky-300/50 mt-0.5">
                {t("multiAngleActionHint")}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-sky-300/40 transition-colors group-hover:text-sky-300/70" />
          </button>
        </div>

        {/* Tier 2: SECONDARY actions */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gray-600" />
            <span className="h-1 w-1 rounded-full bg-gray-700" />
          </div>
          <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans">
            {t("workflowSecondaryLabel")}
          </p>
          <span className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={onVariation}
            disabled={generating}
            className="flex items-center gap-2.5 rounded-sm border border-white/[0.06] bg-white/[0.01] px-3 py-2.5 text-left transition-all duration-200 hover:border-violet-300/22 hover:bg-violet-300/[0.04] hover:-translate-y-[0.5px] active:scale-[0.98] disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-violet-300/30 focus-visible:outline-none"
          >
            <WandSparkles className="h-3 w-3 text-violet-300" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400 hover:text-gray-300">
              {t("variationAction")}
            </span>
          </button>
          <button
            onClick={onAnalyze}
            disabled={generating}
            className="flex items-center gap-2.5 rounded-sm border border-white/[0.06] bg-white/[0.01] px-3 py-2.5 text-left transition-all duration-200 hover:border-emerald-300/22 hover:bg-emerald-300/[0.04] hover:-translate-y-[0.5px] active:scale-[0.98] disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-emerald-300/30 focus-visible:outline-none"
          >
            <ScanLine className="h-3 w-3 text-emerald-300" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-gray-400 hover:text-gray-300">
              {t("analyzeAction")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
