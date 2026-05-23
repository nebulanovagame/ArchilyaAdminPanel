"use client";

import { Activity, Check, Circle, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePipelineContext } from "@/stores/pipeline-store";
import { getStageDescriptionKey, getStageNameKey } from "./stage-translations";

export default function StageTracker() {
  const { jobState } = usePipelineContext();
  const t = useTranslations("dashboard.archilyaRender");
  const stages = jobState?.stages ?? [];

  return (
    <aside className="rounded-sm border border-white/10 bg-[#0d0f13] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
        Pipeline Timeline
      </p>
      <div className="mt-4 space-y-3">
        {stages.map((stage) => {
          const isActive = stage.status === "ACTIVE";
          const isRejected = stage.status === "REJECTED";
          const isDone = stage.status === "APPROVED" || stage.status === "DONE";
          const Icon = isRejected ? X : isDone ? Check : isActive ? Activity : Circle;
          const color = isRejected ? "#FF4757" : isDone ? "#2ED573" : isActive ? "#6C63FF" : "#6b7280";

          return (
            <div key={stage.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${isActive ? "animate-pulse" : ""}`} style={{ borderColor: `${color}66`, color }}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="pb-3">
                <p className="text-sm font-bold text-white">{t(getStageNameKey(stage.id))}</p>
                <p className="text-xs leading-relaxed text-gray-500">{t(getStageDescriptionKey(stage.id))}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{stage.status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
