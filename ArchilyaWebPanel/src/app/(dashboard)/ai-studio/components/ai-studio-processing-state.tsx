"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Image, FileText, Sparkles, Palette, Eye } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fadeInLeft, staggerContainer } from "../lib/animation-variants";
import { PROCESSING_STEPS } from "../constants";
import type { ToolConfig } from "../types";

interface AiStudioProcessingStateProps {
  currentStep: number; // 0-indexed, which step is active
  visibleTool: ToolConfig;
}

const STEP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  prepare: Image,
  prompt: FileText,
  generate: Sparkles,
  process: Palette,
  preview: Eye,
};

const STEP_DESC_KEYS: Record<string, string> = {
  prepare: "stepPrepareDesc",
  prompt: "stepPromptDesc",
  generate: "stepGenerateDesc",
  process: "stepProcessDesc",
  preview: "stepPreviewDesc",
};

const STEP_DESC_FALLBACKS: Record<string, string> = {
  prepare: "Görsel yükleniyor ve analiz ediliyor...",
  prompt: "Mimari özellikler prompt'a dönüştürülüyor...",
  generate: "AI görsel üretimi başladı...",
  process: "Sonuç işleniyor ve kalite kontrol yapılıyor...",
  preview: "Önizleme hazırlanıyor...",
};

const DEFAULT_PROCESSING_HELPER =
  "Bu işlem kullanılan araca ve görselin karmaşıklığına göre biraz sürebilir.";
const GENERATE_PROCESSING_HELPER =
  "Görsel üretimi genellikle 10-60 saniye sürer. Karmaşık sahnelerde bu süre uzayabilir.";

export default function AiStudioProcessingState({
  currentStep,
  visibleTool,
}: AiStudioProcessingStateProps) {
  const t = useTranslations("dashboard.aiStudio");

  const [elapsed, setElapsed] = useState(0);
  const isProcessing = currentStep >= 0;

  useEffect(() => {
    if (!isProcessing) {
      const resetTimer = window.setTimeout(() => {
        setElapsed(0);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    const startedAt = Date.now();
    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    };

    const initialTimer = window.setTimeout(updateElapsed, 0);
    const timer = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [isProcessing]);

  const resolveMessage = (key: string, fallback: string) =>
    t.has(key) ? t(key) : fallback;

  const bottomHelperText =
    currentStep === 2
      ? resolveMessage("processingHelper", GENERATE_PROCESSING_HELPER)
      : DEFAULT_PROCESSING_HELPER;

  const estimatedTimeText =
    visibleTool.id === "analysis"
      ? t("processingSecondsLong", { tool: t(`tools.${visibleTool.id}.label`) })
      : visibleTool.id === "plancolor"
        ? t("processingMinutes", { tool: t(`tools.${visibleTool.id}.label`) })
        : visibleTool.id === "sceneedit"
          ? t("processingSecondsLong", { tool: t(`tools.${visibleTool.id}.label`) })
          : visibleTool.id === "multi-angle"
            ? t("processingFluxSeconds", { tool: t(`tools.${visibleTool.id}.label`) })
            : t("preparingSeconds", { tool: t(`tools.${visibleTool.id}.label`) });

  return (
    <div className="relative flex min-h-[320px] flex-col items-center justify-center p-4 sm:p-5">
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/[0.03]">
        <motion.div
          className="h-full bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0"
          initial={{ width: "0%" }}
          animate={{ width: `${((currentStep + 1) / 5) * 100}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Main spinner */}
      <div className="relative mb-5">
        <div className="absolute inset-2 rounded-full bg-primary/6 animate-ping scale-90" />
        <div className="relative w-14 h-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        </div>
      </div>

      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-2 text-center">
          <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans">
            {t("workflowContinue")}
          </p>
          <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
            {estimatedTimeText}
          </p>
        </div>

        <motion.div
          className="w-full space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
        {PROCESSING_STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isDone = index < currentStep;

          return (
            <motion.div
              key={step.id}
              variants={fadeInLeft}
              custom={index}
              className={`relative flex items-start gap-3 rounded-sm px-3 py-3 overflow-hidden transition-all duration-500 ${
                isActive
                  ? "border border-amber-300/18 bg-amber-400/8"
                  : isDone
                    ? "border border-emerald-400/15 bg-emerald-400/5"
                    : "border border-white/[0.04] bg-white/[0.01]"
              }`}
            >
              {isActive && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 left-0 w-px bg-gradient-to-b from-transparent via-amber-300 to-transparent"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
              )}

              {/* Status icon */}
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                  isActive
                    ? "scale-110 border border-amber-300/35 bg-amber-400/12"
                    : isDone
                      ? "bg-emerald-400/10 border border-emerald-400/25"
                      : "bg-white/5 border border-white/[0.06]"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : isActive ? (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    {(() => {
                      const StepIcon = STEP_ICONS[step.id];
                      return StepIcon ? (
                        <StepIcon className="relative h-4 w-4 text-amber-300 animate-pulse" />
                      ) : (
                        <div className="relative w-2 h-2 rounded-full bg-primary" />
                      );
                    })()}
                  </div>
                ) : (() => {
                  const StepIcon = STEP_ICONS[step.id];
                  return StepIcon ? (
                    <StepIcon className="h-3 w-3 text-gray-600" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                  );
                })()}
              </div>

              {/* Label + helper text */}
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-[11px] font-sans font-semibold tracking-wide ${
                    isActive
                      ? "text-amber-300"
                      : isDone
                        ? "text-emerald-400/70"
                        : "text-gray-600"
                  }`}
                >
                  {t(step.labelKey)}
                </span>
                <AnimatePresence mode="wait">
                  {isActive && (
                    <motion.span
                      key={step.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="text-[10px] text-gray-500 font-sans leading-tight mt-0.5"
                    >
                      {resolveMessage(
                        STEP_DESC_KEYS[step.id],
                        STEP_DESC_FALLBACKS[step.id] ?? DEFAULT_PROCESSING_HELPER,
                      )}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
        </motion.div>

        <div className="border-t border-white/[0.04] pt-4">
          <p className="text-[10px] text-gray-700 font-sans">
            {bottomHelperText}
          </p>
          {isProcessing && (
            <p className="mt-1 text-[10px] text-gray-700 font-sans">
              {elapsed < 60
                ? `Süre: ${elapsed} saniye`
                : `Süre: ${Math.floor(elapsed / 60)} dakika ${elapsed % 60} saniye`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
