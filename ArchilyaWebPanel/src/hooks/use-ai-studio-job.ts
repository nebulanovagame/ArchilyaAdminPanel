"use client";

import { useCallback } from "react";

import { useRealtimeDoc } from "@/hooks/use-realtime-doc";
import { INITIAL_AI_STUDIO_JOB, isAiStudioJobTerminal, mapAiStudioJobSnapshot } from "@/lib/ai-studio/job-contract";

export function useAiStudioJob(uid: string | null, jobId: string | null) {
  const mapRow = useCallback((row: Record<string, unknown>) => {
    return mapAiStudioJobSnapshot({
      id: String(row.id || jobId || ""),
      data: () => row,
      exists: true,
    } as never, jobId || "");
  }, [jobId]);

  return useRealtimeDoc({
    table: "ai_studio_jobs",
    id: jobId,
    initialData: INITIAL_AI_STUDIO_JOB,
    mapRow,
    shouldPoll: (job) => Boolean(jobId) && job.exists && !isAiStudioJobTerminal(job),
    pollingIntervalMs: 5000,
    retryOnPermissionDenied: false,
  });
}
