"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { JobDocument } from "@/lib/ai-studio/render-pipeline";
import { subscribeToJob, isJobTerminal } from "@/lib/ai-studio/render-pipeline";

export interface UseRenderJobState {
  job: JobDocument | null;
  isLoading: boolean;
  error: Error | null;
}

export function useRenderJob(jobId: string | null) {
  const [state, setState] = useState<UseRenderJobState>({
    job: null,
    isLoading: !!jobId,
    error: null,
  });
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const jobIdRef = useRef(jobId);

  useEffect(() => {
    jobIdRef.current = jobId;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ job: null, isLoading: true, error: null });

    let isActive = true;

    const unsubscribe = subscribeToJob(
      jobId,
      (job) => {
        if (!isActive) return;
        setState({
          job,
          isLoading: false,
          error: null,
        });

        if (isJobTerminal(job) && unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      },
      (error) => {
        if (!isActive) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));
      },
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      isActive = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [jobId]);

  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setState({ job: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    reset,
    isTerminal: state.job ? isJobTerminal(state.job) : false,
    isCompleted: state.job?.status === "completed",
    isFailed: state.job?.status === "failed",
    isCancelled: state.job?.status === "cancelled",
  };
}
