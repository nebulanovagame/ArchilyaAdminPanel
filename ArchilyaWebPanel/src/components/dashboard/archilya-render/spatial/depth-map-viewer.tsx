"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { estimateDepth } from "@/lib/utils/depth-estimation";
import type { Scene } from "@/lib/types/scene";
import { useSpatialContext } from "@/stores/spatial-store";
import { useRenderJob } from "@/hooks/use-render-job";

type DepthMapViewerProps = {
  scene: Scene;
};

export default function DepthMapViewer({ scene }: DepthMapViewerProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const { depthMaps, isGenerating, setDepthMap, setIsGenerating } = useSpatialContext();
  const [sliderValue, setSliderValue] = useState(50);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const depthMap = depthMaps[scene.id];
  const imageUrl = scene.imagePreview ?? scene.thumbnailUrl ?? "";

  const processedJobRef = useRef<string | null>(null);
  const { job: depthJob, isCompleted } = useRenderJob(activeJobId);

  useEffect(() => {
    if (isCompleted && depthJob?.result?.imageUrl && processedJobRef.current !== activeJobId) {
      processedJobRef.current = activeJobId;
      setDepthMap({
        sceneId: scene.id,
        imageUrl,
        depthDataUrl: depthJob.result.imageUrl,
        generatedAt: Date.now(),
      });
      setIsGenerating(false);
      setActiveJobId(null);
    }
  }, [isCompleted, depthJob, activeJobId, imageUrl, scene.id, setDepthMap, setIsGenerating]);

  const handleGenerate = async () => {
    if (!imageUrl) return;

    setIsGenerating(true);
    try {
      const result = await estimateDepth({ imageUrl, sceneId: scene.id });
      setActiveJobId(result.jobId);
    } catch {
      setIsGenerating(false);
    }
  };

  return (
    <section className="rounded-sm border border-white/10 bg-[#0D1B2A] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
            Depth Map
          </p>
          <h2 className="mt-1 text-xl font-serif italic text-white">{scene.label}</h2>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!imageUrl || isGenerating}
          aria-busy={isGenerating}
          className={`flex items-center gap-2 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:outline-none ${
            imageUrl && !isGenerating
              ? "border border-[#6C63FF]/40 bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
          }`}
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
          {isGenerating ? t("spatial.generating") : t("spatial.generateDepthMap")}
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isGenerating ? t("spatial.generating") : ""}
      </div>

      <div className="mt-4 rounded-sm border border-white/10 bg-black/20 p-3">
        <div className="relative min-h-[420px] overflow-hidden rounded-sm bg-black/40 md:min-h-[560px]">
          {imageUrl ? (
            <Image src={imageUrl} alt={`${scene.label} orijinal görsel`} fill unoptimized sizes="100vw" className="object-contain" />
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-gray-500 md:min-h-[560px]">
              {t("spatial.noOriginalImage")}
            </div>
          )}
          {depthMap && (
            <Image
              src={depthMap.depthDataUrl}
              alt={`${scene.label} derinlik haritası`}
              fill
              unoptimized
              sizes="100vw"
              className="object-contain"
              style={{ clipPath: `inset(0 ${100 - sliderValue}% 0 0)` }}
            />
          )}
          <div
            className="absolute top-0 h-full w-0.5 bg-[#6C63FF] shadow-[0_0_18px_#6C63FF]"
            style={{ left: `${sliderValue}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          aria-label={`${scene.label} derinlik karşılaştırma kaydırıcı`}
          onChange={(event) => setSliderValue(Number(event.target.value))}
          className="mt-3 w-full accent-[#6C63FF]"
        />
      </div>
    </section>
  );
}
