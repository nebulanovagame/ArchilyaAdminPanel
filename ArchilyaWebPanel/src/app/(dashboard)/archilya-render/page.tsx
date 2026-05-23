"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Layers, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

import { IntakeProvider, useIntakeContext } from "@/stores/intake-store";
import { AuditProvider, useAuditContext } from "@/stores/audit-store";
import { MarkupProvider } from "@/stores/markup-store";
import { SpatialProvider, useSpatialContext } from "@/stores/spatial-store";
import { PipelineProvider, usePipelineContext } from "@/stores/pipeline-store";
import SceneUploader from "@/components/dashboard/archilya-render/intake/scene-uploader";
import SceneCard from "@/components/dashboard/archilya-render/intake/scene-card";
import MaterialPalette from "@/components/dashboard/archilya-render/intake/material-palette";
import MoodboardUploader from "@/components/dashboard/archilya-render/intake/moodboard-uploader";
import AuditProgressRing from "@/components/dashboard/archilya-render/auditor/audit-progress-ring";
import RedReportModal from "@/components/dashboard/archilya-render/auditor/red-report-modal";
import MarkupDecoderPage from "@/components/dashboard/archilya-render/markup/markup-decoder-page";
import SpatialLockPage from "@/components/dashboard/archilya-render/spatial/spatial-lock-page";
import PipelinePage from "@/components/dashboard/archilya-render/pipeline/pipeline-page";
import { runAudit } from "@/lib/validators/audit-engine";
import { useRenderSession } from "@/hooks/use-render-session";
import { useWorkspace } from "@/hooks/use-workspace";

const VALID_STAGES = ["intake", "markup", "spatial", "pipeline"] as const;
type Stage = (typeof VALID_STAGES)[number];

function getValidStage(stage: string | null): Stage {
  return VALID_STAGES.includes(stage as Stage) ? (stage as Stage) : "intake";
}

function IntakePageContent() {
  const t = useTranslations("dashboard.archilyaRender");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    scenes,
    materials,
    moodboards,
    clientReferences,
    lightPreference,
    isSubmitting,
    setLightPreference,
  } = useIntakeContext();
  const { auditReport, isAuditing, canProceed, startAudit, completeAudit, resetAudit } =
    useAuditContext();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const stage = getValidStage(searchParams.get("stage"));

  const setStageParam = (nextStage: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextStage === "intake") {
      params.delete("stage");
    } else {
      params.set("stage", nextStage);
    }

    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSubmitToAuditor = () => {
    startAudit();
    setIsReportOpen(false);

    timeoutRef.current = window.setTimeout(() => {
      const report = runAudit({
        scenes,
        materials,
        moodboards,
        clientReferences,
        lightPreference,
        isSubmitting,
      });

      completeAudit(report);
      setIsReportOpen(report.criticalCount > 0);
      timeoutRef.current = null;
    }, 1250);
  };

  const handleBackToFix = () => {
    setIsReportOpen(false);
    resetAudit();
  };

  if (stage === "markup") {
    return (
      <MarkupDecoderPage
        scenes={scenes}
        onBackToIntake={() => setStageParam("intake")}
        onProceedToSpatial={() => setStageParam("spatial")}
      />
    );
  }

  if (stage === "spatial") {
    return (
      <SpatialLockPage
        scenes={scenes}
        onBackToMarkup={() => setStageParam("markup")}
        onProceedToPipeline={() => setStageParam("pipeline")}
      />
    );
  }

  if (stage === "pipeline") {
    return <PipelinePage scenes={scenes} onBackToSpatial={() => setStageParam("spatial")} />;
  }

  return (
    <div className="mx-auto max-w-[1600px] p-5 md:p-6 xl:px-7 xl:py-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-primary text-[10px] uppercase tracking-[0.3em]">
              {t("eyebrow")}
            </p>
            <h1 className="text-3xl font-serif text-white italic">
              {t("title")}
            </h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm font-sans text-gray-400">
          {t("intakeSubtitle")}
        </p>
      </motion.div>

      {/* Scene Upload Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <span className="text-xs font-sans font-medium uppercase tracking-widest text-gray-400">
            {t("scenesTitle")}
          </span>
          <span className="text-[10px] font-sans text-gray-600">{t("scenesSubtitle")}</span>
        </div>

        <SceneUploader />

        {/* Scene Cards */}
        {scenes.length > 0 && (
          <div className="space-y-3">
            {scenes.map((scene, index) => (
              <SceneCard key={scene.id} sceneId={scene.id} index={index} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Material Palette Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/10 mb-4">
          <span className="text-xs font-sans font-medium uppercase tracking-widest text-gray-400">
            {t("materialsSectionTitle")}
          </span>
        </div>

        <MaterialPalette />
      </motion.section>

      {/* Light / Atmosphere */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <span className="text-xs font-sans font-medium uppercase tracking-widest text-gray-400">
            {t("lightAtmosphereTitle")}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { value: "sunny" as const, label: t("light.sunny") },
            { value: "cloudy" as const, label: t("light.cloudy") },
            { value: "sunset" as const, label: t("light.sunset") },
            { value: "night" as const, label: t("light.night") },
            { value: "overcast" as const, label: t("light.overcast") },
            { value: "golden-hour" as const, label: t("light.goldenHour") },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setLightPreference(
                  lightPreference === option.value ? null : option.value,
                )
              }
              className={`px-4 py-2 rounded-sm text-xs font-medium uppercase tracking-wider transition-all ${
                lightPreference === option.value
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10 hover:text-gray-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <span className="text-xs font-sans font-medium uppercase tracking-widest text-gray-400">
            {t("moodboardsSectionTitle")}
          </span>
        </div>
        <MoodboardUploader />
      </motion.section>

      {/* Submit to Auditor */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="pt-4 border-t border-white/10"
      >
        <button
          type="button"
          onClick={handleSubmitToAuditor}
          disabled={isAuditing}
          className="w-full flex items-center justify-center gap-3 py-4 bg-primary/10 border border-primary/20 text-primary rounded-sm text-sm font-bold uppercase tracking-widest hover:bg-primary hover:text-black transition-all duration-300"
        >
          <ShieldCheck className="w-4 h-4" />
          {isAuditing ? t("auditInProgress") : t("submitToAuditor")}
        </button>

        {isAuditing && (
          <div className="mt-4">
            <AuditProgressRing isAuditing={isAuditing} />
          </div>
        )}

        {isMounted && auditReport && !isAuditing && (
          <div className="mt-4 rounded-sm border border-white/10 bg-[#0d0f13] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-sans text-gray-400">
                <span className="text-[#FF4757]">{auditReport.criticalCount} critical</span>
                <span className="mx-2 text-gray-600">/</span>
                <span className="text-[#FFA502]">{auditReport.warningCount} warning</span>
              </div>
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStageParam("markup")}
                className={`flex items-center gap-2 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                  canProceed
                    ? "border border-[#2ED573]/30 bg-[#2ED573]/10 text-[#2ED573] hover:bg-[#2ED573] hover:text-black"
                    : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-600"
                }`}
              >
                {t("proceedToMarkup")}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {auditReport && isReportOpen && (
        <RedReportModal report={auditReport} onBack={handleBackToFix} />
      )}
    </div>
  );
}

function RenderSessionSync() {
  const { activeWorkspace } = useWorkspace();
  const {
    scenes,
    materials,
    lightPreference,
  } = useIntakeContext();
  const { metricLocks, consistencyResult } = useSpatialContext();
  const { jobState, outputImageUrl, outputImageUrls } = usePipelineContext();
  const searchParams = useSearchParams();
  const stage = getValidStage(searchParams.get("stage"));
  const {
    session,
    sessionId,
    createSession,
    updateStatus,
    updateScenes,
    updateMaterials,
    updateLightPreference,
    updateMetricLocks,
    updateConsistencyScore,
    updateJobId,
    updateOutputImageUrls,
    flushUpdates,
  } = useRenderSession();
  const hasCreatedRef = useRef(false);

  // Create session on first meaningful data
  useEffect(() => {
    if (sessionId || !activeWorkspace?.id || scenes.length === 0 || hasCreatedRef.current) return;

    hasCreatedRef.current = true;
    void createSession({
      status: "draft",
      scenes: scenes.map((s) => ({
        id: s.id,
        label: s.label,
        direction: s.direction,
        type: s.type,
        hasFurnishing: s.hasFurnishing,
        frameQuality: s.frameQuality,
        order: s.order,
        imageUrl: s.imagePreview || s.thumbnailUrl || undefined,
      })),
      materials: materials.map((m) => ({
        id: m.id,
        label: m.label,
        category: m.category,
        imageUrl: m.imagePreview || undefined,
      })),
      lightPreference,
    });
  }, [sessionId, activeWorkspace, scenes, materials, lightPreference, createSession]);

  // Update status on stage transition
  useEffect(() => {
    if (!sessionId) return;

    const statusMap: Record<Stage, string> = {
      intake: "draft",
      markup: "markup-done",
      spatial: "spatial-locked",
      pipeline: jobState?.completedAt ? "completed" : jobState ? "rendering" : "audited",
    };

    const newStatus = statusMap[stage];
    if (session?.status !== newStatus) {
      updateStatus(newStatus as "draft" | "audited" | "markup-done" | "spatial-locked" | "rendering" | "completed" | "failed");
    }
  }, [stage, sessionId, session?.status, jobState, updateStatus]);

  // Auto-save intake data changes
  useEffect(() => {
    if (!sessionId) return;

    updateScenes(
      scenes.map((s) => ({
        id: s.id,
        label: s.label,
        direction: s.direction,
        type: s.type,
        hasFurnishing: s.hasFurnishing,
        frameQuality: s.frameQuality,
        order: s.order,
        imageUrl: s.imagePreview || s.thumbnailUrl || undefined,
      })),
    );
  }, [scenes, sessionId, updateScenes]);

  useEffect(() => {
    if (!sessionId) return;

    updateMaterials(
      materials.map((m) => ({
        id: m.id,
        label: m.label,
        category: m.category,
        imageUrl: m.imagePreview || undefined,
      })),
    );
  }, [materials, sessionId, updateMaterials]);

  useEffect(() => {
    if (!sessionId) return;
    updateLightPreference(lightPreference);
  }, [lightPreference, sessionId, updateLightPreference]);

  // Auto-save spatial data
  useEffect(() => {
    if (!sessionId) return;

    const locks = Object.entries(metricLocks).map(([sceneId, lock]) => ({
      sceneId,
      aspectRatio: lock.aspectRatio,
      estimatedDepth: lock.estimatedDepth,
      volumeScore: lock.volumeScore,
      isLocked: lock.isLocked,
    }));

    if (locks.length > 0) {
      updateMetricLocks(
        Object.fromEntries(locks.map((l) => [l.sceneId, l])),
      );
    }
  }, [metricLocks, sessionId, updateMetricLocks]);

  useEffect(() => {
    if (!sessionId || consistencyResult === null) return;
    updateConsistencyScore(consistencyResult.consistencyScore);
  }, [consistencyResult, sessionId, updateConsistencyScore]);

  // Auto-save pipeline data
  useEffect(() => {
    if (!sessionId || !jobState?.jobId) return;
    updateJobId(jobState.jobId);
  }, [jobState?.jobId, sessionId, updateJobId]);

  useEffect(() => {
    if (!sessionId) return;
    const nextOutputImageUrls = outputImageUrls.length ? outputImageUrls : outputImageUrl ? [outputImageUrl] : [];
    if (!nextOutputImageUrls.length) return;
    updateOutputImageUrls(nextOutputImageUrls);
  }, [outputImageUrl, outputImageUrls, sessionId, updateOutputImageUrls]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      void flushUpdates();
    };
  }, [flushUpdates]);

  return null;
}

export default function ArchilyaRenderPage() {
  return (
    <IntakeProvider>
      <AuditProvider>
        <MarkupProvider>
          <SpatialProvider>
            <PipelineProvider>
              <RenderSessionSync />
              <IntakePageContent />
            </PipelineProvider>
          </SpatialProvider>
        </MarkupProvider>
      </AuditProvider>
    </IntakeProvider>
  );
}
