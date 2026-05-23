"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RenderSession, RenderSessionInput, RenderSessionStatus } from "@/lib/types/render-session";
import {
  createRenderSession,
  updateRenderSession,
  watchRenderSession,
  type watchUserRenderSessions,
} from "@/lib/render/session-service";
import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/hooks/use-workspace";

const DEBOUNCE_MS = 2_000;

export interface UseRenderSessionState {
  session: RenderSession | null;
  sessionId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
}

export function useRenderSession(initialSessionId?: string | null) {
  const { currentUser } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [state, setState] = useState<UseRenderSessionState>({
    session: null,
    sessionId: initialSessionId || null,
    isLoading: !!initialSessionId,
    isSaving: false,
    error: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Partial<Omit<RenderSessionInput, "uid" | "workspaceId">> | null>(null);
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (!state.sessionId) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    const unsubscribe = watchRenderSession(
      state.sessionId,
      (session) => {
        setState((prev) => ({
          ...prev,
          session,
          isLoading: false,
          error: null,
        }));
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error,
        }));
      },
    );

    return () => unsubscribe();
  }, [state.sessionId]);

  const flushUpdates = useCallback(async () => {
    if (!state.sessionId || !pendingUpdatesRef.current) return;

    const updates = pendingUpdatesRef.current;
    pendingUpdatesRef.current = null;

    setState((prev) => ({ ...prev, isSaving: true }));
    try {
      await updateRenderSession(state.sessionId, updates);
      setState((prev) => ({ ...prev, isSaving: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: error instanceof Error ? error : new Error("Session güncellenemedi."),
      }));
    }
  }, [state.sessionId]);

  const scheduleUpdate = useCallback(
    (updates: Partial<Omit<RenderSessionInput, "uid" | "workspaceId">>) => {
      pendingUpdatesRef.current = {
        ...pendingUpdatesRef.current,
        ...updates,
      };

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        void flushUpdates();
      }, DEBOUNCE_MS);
    },
    [flushUpdates],
  );

  const createSession = useCallback(
    async (input: Omit<RenderSessionInput, "uid" | "workspaceId">) => {
      if (!currentUser?.uid || !activeWorkspace?.id || isCreatingRef.current) {
        return null;
      }

      isCreatingRef.current = true;
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const result = await createRenderSession({
          uid: currentUser.uid,
          workspaceId: activeWorkspace.id,
          ...input,
        });

        setState((prev) => ({
          ...prev,
          sessionId: result.id,
          isLoading: false,
          error: null,
        }));

        return result.id;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error("Session oluşturulamadı."),
        }));
        return null;
      } finally {
        isCreatingRef.current = false;
      }
    },
    [currentUser, activeWorkspace],
  );

  const updateStatus = useCallback(
    (status: RenderSessionStatus) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, status },
            }
          : prev,
      );
      scheduleUpdate({ status });
    },
    [scheduleUpdate],
  );

  const updateScenes = useCallback(
    (scenes: RenderSession["scenes"]) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, scenes },
            }
          : prev,
      );
      scheduleUpdate({ scenes });
    },
    [scheduleUpdate],
  );

  const updateMaterials = useCallback(
    (materials: RenderSession["materials"]) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, materials },
            }
          : prev,
      );
      scheduleUpdate({ materials });
    },
    [scheduleUpdate],
  );

  const updateLightPreference = useCallback(
    (lightPreference: string | null) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, lightPreference },
            }
          : prev,
      );
      scheduleUpdate({ lightPreference });
    },
    [scheduleUpdate],
  );

  const updateMetricLocks = useCallback(
    (metricLocks: RenderSession["metricLocks"]) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, metricLocks },
            }
          : prev,
      );
      scheduleUpdate({ metricLocks });
    },
    [scheduleUpdate],
  );

  const updateConsistencyScore = useCallback(
    (consistencyScore: number | null) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, consistencyScore },
            }
          : prev,
      );
      scheduleUpdate({ consistencyScore });
    },
    [scheduleUpdate],
  );

  const updateJobId = useCallback(
    (jobId: string) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, jobId },
            }
          : prev,
      );
      scheduleUpdate({ jobId });
    },
    [scheduleUpdate],
  );

  const updateOutputImageUrls = useCallback(
    (outputImageUrls: string[]) => {
      setState((prev) =>
        prev.session
          ? {
              ...prev,
              session: { ...prev.session, outputImageUrls },
            }
          : prev,
      );
      scheduleUpdate({ outputImageUrls });
    },
    [scheduleUpdate],
  );

  const setSessionId = useCallback((sessionId: string | null) => {
    setState((prev) => ({
      ...prev,
      sessionId,
      session: sessionId === prev.sessionId ? prev.session : null,
      isLoading: !!sessionId,
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (pendingUpdatesRef.current && state.sessionId) {
        void flushUpdates();
      }
    };
  }, [flushUpdates, state.sessionId]);

  return {
    ...state,
    createSession,
    setSessionId,
    updateStatus,
    updateScenes,
    updateMaterials,
    updateLightPreference,
    updateMetricLocks,
    updateConsistencyScore,
    updateJobId,
    updateOutputImageUrls,
    flushUpdates,
  };
}
