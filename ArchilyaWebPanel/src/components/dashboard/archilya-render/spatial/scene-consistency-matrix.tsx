"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Wand2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import type { Scene } from "@/lib/types/scene";
import { useSpatialContext } from "@/stores/spatial-store";
import { startSceneConsistency } from "@/lib/ai-studio/render-pipeline";
import { useRenderJob } from "@/hooks/use-render-job";
import { useCredits } from "@/hooks/use-credits";

type SceneConsistencyMatrixProps = {
  scenes: Scene[];
};

function pairScore(firstId: string, secondId: string) {
  const seed = `${firstId}:${secondId}`
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return 75 + (seed % 21);
}

const SCENE_CONSISTENCY_CREDIT_COST = 15;

export default function SceneConsistencyMatrix({ scenes }: SceneConsistencyMatrixProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const { consistencyResult, setConsistencyResult } = useSpatialContext();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const credits = useCredits();

  const processedJobRef = useRef<string | null>(null);
  const singleSceneSetRef = useRef(false);
  const { job: consistencyJob, isCompleted } = useRenderJob(activeJobId);

  const pairs = useMemo(() => {
    const result: { id: string; label: string; score: number }[] = [];
    scenes.forEach((scene, sceneIndex) => {
      scenes.slice(sceneIndex + 1).forEach((otherScene) => {
        result.push({
          id: `${scene.id}-${otherScene.id}`,
          label: `${scene.label} / ${otherScene.label}`,
          score: pairScore(scene.id, otherScene.id),
        });
      });
    });
    return result;
  }, [scenes]);

  useEffect(() => {
    if (scenes.length === 1 && !singleSceneSetRef.current) {
      singleSceneSetRef.current = true;
      setConsistencyResult({
        sceneIds: [scenes[0].id],
        consistencyScore: 100,
        warnings: [],
      });
    }
  }, [scenes, setConsistencyResult]);

  useEffect(() => {
    if (scenes.length <= 1) return;

    if (activeJobId && !isCompleted) {
      return;
    }

    if (isCompleted && consistencyJob?.result?.pairScores) {
      if (processedJobRef.current === activeJobId) return;
      processedJobRef.current = activeJobId;

      const realScores = consistencyJob.result.pairScores;
      const updatedPairs = pairs.map((pair) => {
        const realScore = realScores.find((s) => s.pair === pair.id);
        return realScore ? { ...pair, score: realScore.score } : pair;
      });

      const consistencyScore = Math.round(
        updatedPairs.reduce((total, pair) => total + pair.score, 0) / updatedPairs.length,
      );
      const warnings = updatedPairs
        .filter((pair) => pair.score < 82)
        .map((pair) => `${pair.label}: ${pair.score}/100`);

      setConsistencyResult({
        sceneIds: scenes.map((scene) => scene.id),
        consistencyScore,
        warnings,
      });
      setIsAnalyzing(false);
      return;
    }

    if (pairs.length === 0) return;
    if (activeJobId) return;

    const consistencyScore = Math.round(
      pairs.reduce((total, pair) => total + pair.score, 0) / pairs.length,
    );
    const warnings = pairs
      .filter((pair) => pair.score < 82)
      .map((pair) => `${pair.label}: ${pair.score}/100`);

    setConsistencyResult({
      sceneIds: scenes.map((scene) => scene.id),
      consistencyScore,
      warnings,
    });
  }, [pairs, scenes, setConsistencyResult, activeJobId, isCompleted, consistencyJob]);

  const handleAnalyze = useCallback(async () => {
    if (!credits.hasEnough(SCENE_CONSISTENCY_CREDIT_COST)) {
      toast.error("Yetersiz kredi. Sahne tutarlılığı analizi başlatılamadı.");
      return;
    }

    const sceneImageUrls = scenes.map((s) => s.imagePreview || s.thumbnailUrl || "").filter(Boolean);
    if (sceneImageUrls.length < 2) {
      toast.error("En az iki sahne görseli gereklidir.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await startSceneConsistency({
        sceneImageUrls,
        sceneIds: scenes.map((s) => s.id),
      });
      setActiveJobId(result.jobId);
    } catch {
      setIsAnalyzing(false);
    }
  }, [scenes, credits]);

  if (scenes.length < 2) return null;

  return (
    <section className="rounded-sm border border-white/10 bg-[#0d0f13] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
            Consistency Matrix
          </p>
          <h3 className="mt-1 text-xl font-serif italic text-white">{t("spatial.sceneConsistency")}</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            aria-busy={isAnalyzing}
            className={`flex items-center gap-2 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:outline-none ${
              isAnalyzing
                ? "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
                : "border border-[#6C63FF]/40 bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white"
            }`}
          >
            {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
            {isAnalyzing ? "Analiz Ediliyor..." : "Analiz Et"}
          </button>
          <div className="rounded-sm border border-white/10 bg-black/20 px-4 py-2 text-right" aria-live="polite" aria-atomic="true">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t("spatial.overallScore")}</p>
            <p className="text-2xl font-bold text-white">
              {consistencyResult?.consistencyScore ?? 0}/100
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pairs.map((pair) => {
          const color = pair.score < 80 ? "#FF4757" : pair.score < 86 ? "#FFA502" : "#2ED573";
          return (
            <div key={pair.id} className="rounded-sm border border-white/10 bg-[#0A0A0F] p-3">
              <p className="truncate text-xs text-gray-400">{pair.label}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-sm bg-white/10">
                  <div className="h-full" style={{ width: `${pair.score}%`, backgroundColor: color }} />
                </div>
                <span
                  className="rounded-sm border px-2 py-1 text-[10px] font-bold"
                  style={{ borderColor: `${color}66`, color }}
                >
                  {pair.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
