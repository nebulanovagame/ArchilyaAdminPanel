"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Scene } from "@/lib/types/scene";
import { useSpatialContext } from "@/stores/spatial-store";
import VolumeLockBadge from "@/components/dashboard/archilya-render/spatial/volume-lock-badge";

type MetricCalibrationProps = {
  scene: Scene;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildFallbackLock(scene: Scene) {
  const aspectRatio = scene.imageFile ? 1.5 : 1.33;
  const estimatedDepth = clampScore(scene.frameQuality * 0.72 + (scene.hasFurnishing ? 18 : 4));
  const volumeScore = clampScore((estimatedDepth + scene.frameQuality) / 2);

  return {
    sceneId: scene.id,
    aspectRatio,
    estimatedDepth,
    volumeScore,
    isLocked: false,
  };
}

export default function MetricCalibration({ scene }: MetricCalibrationProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const { depthMaps, metricLocks, setMetricLock, lockScene } = useSpatialContext();
  const depthMap = depthMaps[scene.id];
  const metricLock = metricLocks[scene.id] ?? buildFallbackLock(scene);
  const lockTimestamp = depthMap?.generatedAt ?? 0;

  const handleLock = () => {
    setMetricLock(metricLock);
    lockScene(scene.id);
  };

  return (
    <section className="rounded-sm border border-white/10 bg-[#0d0f13] p-4">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
            Metric Calibration
          </p>
          <h3 className="mt-1 text-xl font-serif italic text-white">{t("spatial.massMeasurement")}</h3>
        </div>
        {metricLock.isLocked && <VolumeLockBadge timestamp={lockTimestamp} />}
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-sm border border-white/10 bg-black/20 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t("spatial.aspectRatio")}
          </p>
          <p className="mt-1 text-2xl font-serif italic text-white">
            {metricLock.aspectRatio.toFixed(2)}:1
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-widest text-gray-500">{t("spatial.estimatedDepth")}</span>
            <span className="text-gray-300">{metricLock.estimatedDepth}/100</span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-white/10">
            <div
              className="h-full bg-[#6C63FF] transition-all"
              style={{ width: `${metricLock.estimatedDepth}%` }}
            />
          </div>
        </div>

        <div className="rounded-sm border border-white/10 bg-black/20 p-4 text-center">
          <div
            className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-8 border-[#2ED573]/30 text-2xl font-bold text-[#2ED573]"
            style={{ boxShadow: `inset 0 0 0 ${Math.max(0, metricLock.volumeScore / 8)}px rgba(46,213,115,0.08)` }}
          >
            {metricLock.volumeScore}
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {t("spatial.volumeScore")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLock}
          disabled={!depthMap || metricLock.isLocked}
          className={`flex w-full items-center justify-center gap-2 rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
            depthMap && !metricLock.isLocked
              ? "border border-[#2ED573]/30 bg-[#2ED573]/10 text-[#2ED573] hover:bg-[#2ED573] hover:text-black"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          {metricLock.isLocked ? t("spatial.locked") : t("spatial.lockMass")}
        </button>
      </div>
    </section>
  );
}
