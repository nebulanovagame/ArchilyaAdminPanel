"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import DepthMapViewer from "@/components/dashboard/archilya-render/spatial/depth-map-viewer";
import MetricCalibration from "@/components/dashboard/archilya-render/spatial/metric-calibration";
import SceneConsistencyMatrix from "@/components/dashboard/archilya-render/spatial/scene-consistency-matrix";
import type { Scene } from "@/lib/types/scene";
import { useSpatialContext } from "@/stores/spatial-store";

type SpatialLockPageProps = {
  scenes: Scene[];
  onBackToMarkup: () => void;
  onProceedToPipeline: () => void;
};

function buildMetricLock(scene: Scene) {
  const aspectRatio = scene.imageFile ? 1.5 : 1.33;
  const estimatedDepth = Math.max(0, Math.min(100, Math.round(scene.frameQuality * 0.72 + (scene.hasFurnishing ? 18 : 4))));
  const volumeScore = Math.max(0, Math.min(100, Math.round((estimatedDepth + scene.frameQuality) / 2)));

  return {
    sceneId: scene.id,
    aspectRatio,
    estimatedDepth,
    volumeScore,
    isLocked: false,
  };
}

export default function SpatialLockPage({
  scenes,
  onBackToMarkup,
  onProceedToPipeline,
}: SpatialLockPageProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const { metricLocks, consistencyResult, allScenesLocked, setMetricLock } = useSpatialContext();
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]?.id ?? "");
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0] ?? null;
  const canSendToCouncil = allScenesLocked && (consistencyResult?.consistencyScore ?? 0) >= 70;

  useEffect(() => {
    scenes.forEach((scene) => {
      const existing = metricLocks[scene.id];
      if (!existing || !existing.isLocked) {
        // Build (or rebuild) the lock and set isLocked:true in a single call
        const base = existing ?? buildMetricLock(scene);
        setMetricLock({ ...base, isLocked: true });
      }
    });
  }, [metricLocks, scenes, setMetricLock]);

  const lockedCount = useMemo(
    () => scenes.filter((scene) => metricLocks[scene.id]?.isLocked).length,
    [metricLocks, scenes],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-5 md:p-6 xl:px-7 xl:py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
            Spatial Lock
          </p>
          <h1 className="mt-1 text-3xl font-serif italic text-white">{t("spatial.massLocking")}</h1>
        </div>
        <button
          type="button"
          onClick={onBackToMarkup}
          className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("spatial.backToMarkup")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-sm border border-white/10 bg-[#0d0f13] p-3">
        {scenes.map((scene) => {
          const isActive = activeScene?.id === scene.id;
          const isLocked = metricLocks[scene.id]?.isLocked;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => setActiveSceneId(scene.id)}
              className={`rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                isActive
                  ? "border-[#6C63FF]/50 bg-[#6C63FF]/20 text-[#6C63FF]"
                  : "border-white/10 bg-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300"
              }`}
            >
              {scene.label || scene.id}
              {isLocked && <span className="ml-2 text-[#2ED573]">●</span>}
            </button>
          );
        })}
      </div>

      {activeScene && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DepthMapViewer scene={activeScene} />
          <MetricCalibration scene={activeScene} />
        </div>
      )}

      <SceneConsistencyMatrix scenes={scenes} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/10 bg-[#0d0f13] p-4">
        <p className="text-xs text-gray-500">
          {lockedCount}/{scenes.length} {t("spatial.scenesLocked")} · {t("spatial.minimumConsistencyScore")}: 70/100
        </p>
        <button
          type="button"
          disabled={!canSendToCouncil}
          onClick={onProceedToPipeline}
          className={`flex items-center gap-2 rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
            canSendToCouncil
              ? "border border-[#2ED573]/30 bg-[#2ED573]/10 text-[#2ED573] hover:bg-[#2ED573] hover:text-black"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          {t("spatial.sendToCouncil")}
        </button>
      </div>
    </div>
  );
}
