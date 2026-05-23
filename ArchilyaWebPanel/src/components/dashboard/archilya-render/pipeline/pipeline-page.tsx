"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import AgentCouncilMonitor from "@/components/dashboard/archilya-render/pipeline/agent-council-monitor";
import FinalOutputViewer from "@/components/dashboard/archilya-render/pipeline/final-output-viewer";
import QualityGate from "@/components/dashboard/archilya-render/pipeline/quality-gate";
import StageTracker from "@/components/dashboard/archilya-render/pipeline/stage-tracker";
import type { Scene } from "@/lib/types/scene";
import { usePipelineContext } from "@/stores/pipeline-store";
import { useIntakeContext } from "@/stores/intake-store";
import { useCredits } from "@/hooks/use-credits";

type PipelinePageProps = {
  scenes: Scene[];
  onBackToSpatial: () => void;
};

function formatEta(ms: number) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}dk ${seconds}sn` : `${seconds}sn`;
}

const RENDER_PIPELINE_CREDIT_COST = 50;
const MAX_PIPELINE_ETA_MS = 10 * 60_000;

export default function PipelinePage({ scenes, onBackToSpatial }: PipelinePageProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const { jobState, isRunning, startPipeline, pipelineError } = usePipelineContext();
  const { materials, moodboards, lightPreference } = useIntakeContext();
  const credits = useCredits();
  const [now, setNow] = useState(() => Date.now());
  const isComplete = Boolean(jobState?.completedAt) && !pipelineError;
  const elapsedMs = jobState ? now - jobState.startedAt : 0;
  const progress = jobState?.overallProgress ?? 0;
  const estimatedTotalMs = progress > 0 ? Math.min((elapsedMs / progress) * 100, MAX_PIPELINE_ETA_MS) : 0;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  const etaLabel = isComplete
    ? t("pipeline.completed")
    : pipelineError
      ? t("pipeline.failed")
    : progress > 0
      ? remainingMs > 0
        ? `${t("pipeline.remaining")}: ${formatEta(remainingMs)}`
        : t("pipeline.takingLonger")
      : t("pipeline.etaCalculating");

  useEffect(() => {
    if (!jobState || isComplete) return undefined;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [isComplete, jobState]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-5 md:p-6 xl:px-7 xl:py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
            {t("pipeline.agentCouncil")}
          </p>
          <h1 className="mt-1 text-3xl font-serif italic text-white">{t("pipeline.multiAgentPipeline")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBackToSpatial}
            className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-white/20 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("pipeline.backToSpatial")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!credits.hasEnough(RENDER_PIPELINE_CREDIT_COST)) {
                toast.error(t("pipeline.insufficientCredits"));
                return;
              }
              void startPipeline({
                scenes,
                materials,
                moodboards,
                lightPreference,
              });
            }}
            disabled={isRunning}
            className={`flex items-center gap-2 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
              isRunning
                ? "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
                : "border border-[#6C63FF]/40 bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white"
            }`}
            >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? t("pipeline.running") : t("pipeline.startCouncil")}
          </button>
        </div>
      </div>

      {!jobState ? (
        <div className="rounded-sm border border-white/10 bg-[#1A1A2E] p-8 text-center">
          <p className="text-sm text-gray-400">{t("pipeline.councilNotStarted")}</p>
        </div>
      ) : (
        <>
          <div className="rounded-sm border border-white/10 bg-[#0d0f13] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span>{t("pipeline.pipelineProgress")}</span>
              <span>{etaLabel}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-sm bg-white/10">
              <div className="h-full bg-[#6C63FF] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-right text-xs text-gray-400">{progress}/100</p>
          </div>

          {pipelineError ? (
            <div className="rounded-sm border border-[#FF4757]/30 bg-[#FF4757]/10 p-4 text-sm text-[#ffb3bd]">
              <p className="font-bold text-[#FF4757]">{t("pipeline.failed")}</p>
              <p className="mt-1">{pipelineError}</p>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
            <StageTracker />
            <AgentCouncilMonitor />
            {isComplete ? <FinalOutputViewer scenes={scenes} /> : <QualityGate />}
          </div>
        </>
      )}
    </div>
  );
}
