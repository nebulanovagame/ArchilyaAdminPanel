"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { fadeInDown } from "../lib/animation-variants";
import { useTranslations } from "next-intl";
import type { ToolConfig } from "../types";

interface JobStatusPanelProps {
  activeJobId: string | null;
  visibleTool: ToolConfig | null;
  activeJob: {
    status: string;
    progressMessage?: string;
    error?: { message?: string } | null;
    exists: boolean;
  };
  submittingJob: boolean;
  jobFailureMessage: string | null;
  onRetry?: () => void;
}

function getGenerationLoadingMessage(tool: ToolConfig, toolLabel: string, t: ReturnType<typeof useTranslations>) {
  if (tool.id === "plancolor") return t("dashboard.aiStudio.processingMinutes", { tool: toolLabel });
  if (tool.id === "sceneedit") return t("dashboard.aiStudio.processingSecondsLong", { tool: toolLabel });
  if (tool.id === "img2img" || tool.id === "enhance") return t("dashboard.aiStudio.processingFluxSeconds", { tool: toolLabel });
  if (tool.outputType === "image") return t("dashboard.aiStudio.processingSeconds", { tool: toolLabel });
  return t("dashboard.aiStudio.preparingSeconds", { tool: toolLabel });
}

const statusIconVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { duration: 0.2 } },
  exit: { scale: 0.8, opacity: 0, transition: { duration: 0.15 } },
};

export default function JobStatusPanel({
  activeJobId,
  visibleTool,
  activeJob,
  submittingJob,
  jobFailureMessage,
  onRetry,
}: JobStatusPanelProps) {
  const t = useTranslations();
  if (!activeJobId || !visibleTool) return null;

  const toolLabel = t(`dashboard.aiStudio.tools.${visibleTool.id}.label`);

  const status = activeJob.status;
  const isFailed = status === "failed" || status === "cancelled";
  const isCompleted = status === "completed";
  const isRunning = status === "running";
  const docMissing = !activeJob.exists && !submittingJob;

  let message = t("dashboard.aiStudio.jobPreparing");
  if (docMissing) {
    message = t("dashboard.aiStudio.jobMissing");
  } else if (submittingJob) {
    message = t("dashboard.aiStudio.jobQueueing", { tool: toolLabel });
  } else if (isRunning) {
    message = activeJob.progressMessage || getGenerationLoadingMessage(visibleTool, toolLabel, t);
  } else if (isCompleted) {
    message = t("dashboard.aiStudio.jobCompleted", { tool: toolLabel });
  } else if (isFailed) {
    message = jobFailureMessage || activeJob.error?.message || t("dashboard.aiStudio.jobFailed", { tool: toolLabel });
  } else {
    message = t("dashboard.aiStudio.jobQueued", { tool: toolLabel });
  }

  return (
    <motion.div
      variants={fadeInDown}
      initial="hidden"
      animate="visible"
      className={`flex items-start gap-3 px-4 py-3 rounded-sm border text-xs font-sans ${
        isFailed || docMissing
          ? "bg-red-400/5 border-red-400/20 text-red-300"
          : isCompleted
            ? "bg-emerald-400/5 border-emerald-400/20 text-emerald-300"
            : "bg-primary/5 border-primary/20 text-primary"
      }`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isFailed || docMissing ? "error" : isCompleted ? "success" : "loading"}
          variants={statusIconVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="mt-0.5 flex-shrink-0"
        >
          {isFailed || docMissing ? (
            <AlertCircle className="w-4 h-4" />
          ) : isCompleted ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
        </motion.div>
      </AnimatePresence>
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        <p className="mt-1 text-[10px] opacity-80 break-all">
          {activeJobId} · {t("dashboard.aiStudio.jobTracking")}
        </p>
        {(isFailed || docMissing) && onRetry ? (
          <button
            type="button"
            onClick={() => onRetry?.()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 mt-2 rounded-sm border border-red-400/25 bg-red-400/8 text-[10px] font-bold uppercase tracking-wider text-red-300 hover:border-red-400/40 hover:bg-red-400/12 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Tekrar Dene</span>
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
