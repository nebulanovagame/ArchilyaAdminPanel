"use client";

import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
}

function getGenerationLoadingMessage(tool: ToolConfig, toolLabel: string, t: ReturnType<typeof useTranslations>) {
  if (tool.id === "plancolor") return t("dashboard.aiStudio.processingMinutes", { tool: toolLabel });
  if (tool.id === "sceneedit") return t("dashboard.aiStudio.processingSecondsLong", { tool: toolLabel });
  if (tool.id === "img2img" || tool.id === "enhance") return t("dashboard.aiStudio.processingFluxSeconds", { tool: toolLabel });
  if (tool.outputType === "image") return t("dashboard.aiStudio.processingSeconds", { tool: toolLabel });
  return t("dashboard.aiStudio.preparingSeconds", { tool: toolLabel });
}

export default function JobStatusPanel({
  activeJobId,
  visibleTool,
  activeJob,
  submittingJob,
  jobFailureMessage,
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-sm border text-xs font-sans ${
        isFailed || docMissing
          ? "bg-red-400/5 border-red-400/20 text-red-300"
          : isCompleted
            ? "bg-emerald-400/5 border-emerald-400/20 text-emerald-300"
            : "bg-primary/5 border-primary/20 text-primary"
      }`}
    >
      {isFailed || docMissing ? (
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : isCompleted ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
      )}
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        <p className="mt-1 text-[10px] opacity-80 break-all">
          Job ID: {activeJobId} · {t("dashboard.aiStudio.jobTracking")}
        </p>
      </div>
    </motion.div>
  );
}
