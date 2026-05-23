"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import RevisionRequestForm from "@/components/dashboard/archilya-render/pipeline/revision-request-form";
import { usePipelineContext } from "@/stores/pipeline-store";
import { getStageNameKey } from "./stage-translations";

export default function QualityGate() {
  const t = useTranslations("dashboard.archilyaRender");
  const { jobState, awaitingApproval, approvalStageId, approveStage } = usePipelineContext();
  const [showRevision, setShowRevision] = useState(false);
  const stage = jobState?.stages.find((item) => item.id === approvalStageId);

  if (!awaitingApproval || !stage) return null;

  return (
    <section className="rounded-sm border border-[#6C63FF]/30 bg-[#0d0f13] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
        {t("qualityGate.qualityGate")}
      </p>
      <h3 className="mt-1 text-xl font-serif italic text-white">{t(getStageNameKey(stage.id))}</h3>

      <div className="mt-4 h-48 rounded-sm border border-white/10 bg-[linear-gradient(135deg,#0A0A0F,#1A1A2E,#6C63FF44)]" />

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={approveStage}
          className="flex items-center justify-center gap-2 rounded-sm border border-[#2ED573]/30 bg-[#2ED573]/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#2ED573] transition-all hover:bg-[#2ED573] hover:text-black"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("qualityGate.approveAndContinue")}
        </button>
        <button
          type="button"
          onClick={() => setShowRevision((value) => !value)}
          className="flex items-center justify-center gap-2 rounded-sm border border-[#FF4757]/30 bg-[#FF4757]/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#FF4757] transition-all hover:bg-[#FF4757] hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("qualityGate.requestRevision")}
        </button>
      </div>

      {showRevision && <RevisionRequestForm />}
    </section>
  );
}
