"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import type { Scene } from "@/lib/types/scene";
import { usePipelineContext } from "@/stores/pipeline-store";
import { getStageNameKey } from "./stage-translations";

type FinalOutputViewerProps = {
  scenes: Scene[];
};

export default function FinalOutputViewer({ scenes }: FinalOutputViewerProps) {
  const t = useTranslations("dashboard.archilyaRender.finalOutput");
  const renderT = useTranslations("dashboard.archilyaRender");
  const { jobState, outputImageUrl, outputImageUrls } = usePipelineContext();
  const [sliderValue, setSliderValue] = useState(50);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedScene = scenes[selectedIndex] ?? scenes[0];
  const imageUrl = scenes[0]?.imagePreview ?? "";
  const selectedImageUrl = selectedScene?.imagePreview ?? imageUrl;
  const outputUrl = outputImageUrls[selectedIndex] || outputImageUrl || selectedImageUrl;
  const isGenerating = outputImageUrls.length === 0 && !outputImageUrl && !!jobState && !jobState.completedAt;

  const handleDownload = () => {
    if (!outputUrl) return;
    const anchor = document.createElement("a");
    anchor.href = outputUrl;
    anchor.download = `archilya-render-${jobState?.jobId ?? Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleSave = () => {
    if (!outputUrl) return;
    const key = "archilya-render-saved-outputs";
    const existing = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown[];
    window.localStorage.setItem(
      key,
      JSON.stringify([{ jobId: jobState?.jobId ?? "draft", imageUrl: outputUrl, savedAt: Date.now() }, ...existing]),
    );
    toast.success(t("saved"));
  };

  return (
    <section className="rounded-sm border border-white/10 bg-[#0d0f13] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#2ED573]">
        {t("eyebrow")}
      </p>
      <h3 className="mt-1 text-xl font-serif italic text-white">{t("title")}</h3>
      {isGenerating && <p className="mt-2 text-xs text-gray-500" aria-live="polite" aria-atomic="true">{t("generating")}</p>}

      <div className="mt-4 rounded-sm border border-white/10 bg-black/20 p-3">
        <div className="relative h-72 overflow-hidden rounded-sm bg-[#0A0A0F]">
          {selectedImageUrl && <Image src={selectedImageUrl} alt={t("originalSceneAlt", { label: selectedScene?.label || "" })} fill unoptimized sizes="100vw" className="object-cover" />}
          {outputUrl && <Image src={outputUrl} alt={t("renderOutputAlt", { label: selectedScene?.label || "" })} fill unoptimized sizes="100vw" className="object-cover" style={{ clipPath: `inset(0 ${100 - sliderValue}% 0 0)` }} />}
          <div className="absolute top-0 h-full w-0.5 bg-[#6C63FF]" style={{ left: `${sliderValue}%` }} />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          aria-label={t("comparisonSliderLabel")}
          onChange={(event) => setSliderValue(Number(event.target.value))}
          className="mt-3 w-full accent-[#6C63FF]"
        />
      </div>

      {scenes.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {scenes.map((scene, index) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`rounded-sm border px-3 py-2 text-xs font-bold transition-colors ${selectedIndex === index ? "border-[#6C63FF] bg-[#6C63FF]/20 text-white" : "border-white/10 bg-white/5 text-gray-400"}`}
            >
              {scene.label || `${index + 1}. sahne`}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {jobState?.stages.map((stage) => (
          <div key={stage.id} className="flex items-center justify-between rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs">
            <span className="text-gray-300">{renderT(getStageNameKey(stage.id))}</span>
            <span className="font-bold text-[#2ED573]">{stage.status}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <button type="button" onClick={handleDownload} disabled={!outputUrl} className="flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-300 transition-all disabled:cursor-not-allowed disabled:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("download")}
        </button>
        <button type="button" onClick={handleSave} disabled={!outputUrl} className="flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-300 transition-all disabled:cursor-not-allowed disabled:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
          <Save className="h-3.5 w-3.5" aria-hidden="true" /> {t("saveToProject")}
        </button>
          <button type="button" onClick={() => toast(t("newRenderRequired"))} disabled={isGenerating} className="flex items-center justify-center gap-2 rounded-sm border border-[#6C63FF]/40 bg-[#6C63FF]/20 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#6C63FF] transition-all disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:outline-none">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t("newRender")}
        </button>
      </div>
    </section>
  );
}
