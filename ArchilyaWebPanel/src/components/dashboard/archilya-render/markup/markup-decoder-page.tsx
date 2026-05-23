"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Braces } from "lucide-react";

import AnnotationToolbar from "@/components/dashboard/archilya-render/markup/annotation-toolbar";
import ConstraintList from "@/components/dashboard/archilya-render/markup/constraint-list";
import { markupToJson } from "@/lib/transformers/markup-to-json";
import type { Scene } from "@/lib/types/scene";
import { useMarkupContext } from "@/stores/markup-store";

const FabricCanvas = dynamic(
  () => import("@/components/dashboard/archilya-render/markup/fabric-canvas"),
  { ssr: false },
);

type MarkupDecoderPageProps = {
  scenes: Scene[];
  onBackToIntake: () => void;
  onProceedToSpatial: () => void;
};

export default function MarkupDecoderPage({
  scenes,
  onBackToIntake,
  onProceedToSpatial,
}: MarkupDecoderPageProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const {
    annotations,
    constraints,
    activeSceneId,
    isProcessing,
    setActiveSceneId,
    setConstraints,
    setIsProcessing,
  } = useMarkupContext();
  const activeScene = useMemo(() => {
    return scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0] ?? null;
  }, [scenes, activeSceneId]);
  const activeConstraints = constraints.filter(
    (constraint) => constraint.sceneId === activeScene?.id,
  );
  const hasMissingDescription = activeConstraints.some(
    (constraint) => constraint.description.trim().length === 0,
  );
  const canTransform = activeConstraints.length > 0 && !hasMissingDescription && !isProcessing;
  const canProceedToSpatial = !isProcessing;

  useEffect(() => {
    if (!activeSceneId && scenes[0]) {
      setActiveSceneId(scenes[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTransform = () => {
    if (!activeScene || !canTransform) return;

    setIsProcessing(true);
    const activeAnnotationIds = new Set(
      activeConstraints.map((constraint) => constraint.annotationId),
    );
    const nextConstraints = markupToJson(
      annotations.filter((annotation) => activeAnnotationIds.has(annotation.id)),
      activeConstraints,
    );

    setConstraints([
      ...constraints.filter((constraint) => constraint.sceneId !== activeScene.id),
      ...nextConstraints,
    ]);
    setIsProcessing(false);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-5 md:p-6 xl:px-7 xl:py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
            Markup Decoder
          </p>
          <h1 className="mt-1 text-3xl font-serif italic text-white">{t("markup.criticalReader")}</h1>
        </div>

        <button
          type="button"
          onClick={onBackToIntake}
          className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("markup.backToIntake")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-white/10 bg-[#0d0f13] p-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {t("markup.scene")}
        </span>
        <select
          value={activeScene?.id ?? ""}
          onChange={(event) => setActiveSceneId(event.target.value)}
          className="min-w-64 rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 outline-none transition-colors focus:border-[#6C63FF]/50"
        >
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.label || scene.id}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[112px_minmax(0,1fr)_360px]">
        <AnnotationToolbar />
        <div className="min-w-0">
          {activeScene ? (
            <FabricCanvas
              key={activeScene.id}
              sceneId={activeScene.id}
              sceneImagePreview={activeScene.imagePreview}
            />
          ) : (
            <div className="flex min-h-[560px] items-center justify-center rounded-sm border border-white/10 bg-[#0A0A0F] text-sm text-gray-500">
              {t("markup.noSceneForMarkup")}
            </div>
          )}
        </div>
        <ConstraintList />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/10 bg-[#0d0f13] p-4">
          <p className="text-xs text-gray-500">
          {activeConstraints.length === 0
            ? t("markup.optionalHint")
            : !canTransform
              ? t("markup.addDescriptionToAll")
              : t("markup.constraintJsonReady")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTransform}
            disabled={!canTransform}
            title={!canTransform ? t("markup.addDescriptionToAll") : undefined}
            className={`flex items-center gap-2 rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
              canTransform
                ? "border border-[#6C63FF]/40 bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white"
                : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
            }`}
          >
            <Braces className="h-3.5 w-3.5" />
            {t("markup.transformToConstraint")}
          </button>
          <button
            type="button"
            onClick={onProceedToSpatial}
            disabled={!canProceedToSpatial}
            className={`flex items-center gap-2 rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
              canProceedToSpatial
                ? "border border-[#6C63FF]/40 bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF] hover:text-white"
                : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
            }`}
          >
            {t("markup.goToSpatialLock")}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
