"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { PipelineStage } from "@/lib/types/agent";
import { usePipelineContext } from "@/stores/pipeline-store";
import { getStageNameKey } from "./stage-translations";

export default function RevisionRequestForm() {
  const t = useTranslations("dashboard.archilyaRender");
  const { jobState, approvalStageId, requestRevision } = usePipelineContext();
  const [stageId, setStageId] = useState<PipelineStage["id"]>(approvalStageId ?? 1);
  const [feedback, setFeedback] = useState("");
  const [updateConstraints, setUpdateConstraints] = useState(false);
  const stages = jobState?.stages ?? [];
  const canSubmit = feedback.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    requestRevision(
      `${feedback.trim()}${updateConstraints ? ` · ${t("qualityGate.updateConstraints")}` : ""}`,
      stageId,
    );
  };

  return (
    <div className="mt-4 rounded-sm border border-white/10 bg-black/20 p-3">
      <div className="grid gap-3">
        <select
          value={stageId}
          onChange={(event) => setStageId(Number(event.target.value) as PipelineStage["id"])}
          className="rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 outline-none focus:border-[#6C63FF]/50"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>{t(getStageNameKey(stage.id))}</option>
          ))}
        </select>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={4}
          placeholder={t("qualityGate.revisionFeedback")}
          className="resize-none rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 outline-none placeholder:text-gray-600 focus:border-[#6C63FF]/50"
        />
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={updateConstraints}
          onChange={(event) => setUpdateConstraints(event.target.checked)}
            className="accent-[#6C63FF]"
          />
          {t("qualityGate.updateConstraints")}
        </label>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
            canSubmit
              ? "border border-[#6C63FF]/40 bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
          }`}
        >
          {t("qualityGate.startRevision")}
        </button>
      </div>
    </div>
  );
}
