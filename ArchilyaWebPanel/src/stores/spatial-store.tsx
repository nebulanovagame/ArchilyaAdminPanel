"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { ConsistencyResult, DepthMap, MetricLock } from "@/lib/types/spatial";

type SpatialContextValue = {
  depthMaps: Record<string, DepthMap>;
  metricLocks: Record<string, MetricLock>;
  consistencyResult: ConsistencyResult | null;
  isGenerating: boolean;
  allScenesLocked: boolean;
  setDepthMap: (depthMap: DepthMap) => void;
  setMetricLock: (metricLock: MetricLock) => void;
  lockScene: (sceneId: string) => void;
  setConsistencyResult: (result: ConsistencyResult) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  resetSpatial: () => void;
};

const SPATIAL_DRAFT_STORAGE_KEY = "archilya-render-spatial-draft";

type PersistedSpatialDraft = {
  depthMaps: Record<string, DepthMap>;
  metricLocks: Record<string, MetricLock>;
  consistencyResult: ConsistencyResult | null;
};

const SpatialContext = createContext<SpatialContextValue | null>(null);

function readPersistedDraft(): PersistedSpatialDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(SPATIAL_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as PersistedSpatialDraft) : null;
  } catch {
    return null;
  }
}

export function SpatialProvider({ children }: { children: ReactNode }) {
  const [depthMaps, setDepthMaps] = useState<Record<string, DepthMap>>({});
  const [metricLocks, setMetricLocks] = useState<Record<string, MetricLock>>({});
  const [consistencyResult, setConsistencyResultState] = useState<ConsistencyResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const draft = readPersistedDraft();
    if (!draft) return;
    startTransition(() => {
      if (draft.depthMaps && Object.keys(draft.depthMaps).length > 0) setDepthMaps(draft.depthMaps);
      if (draft.metricLocks && Object.keys(draft.metricLocks).length > 0) setMetricLocks(draft.metricLocks);
      if (draft.consistencyResult) setConsistencyResultState(draft.consistencyResult);
    });
  }, []);

  useEffect(() => {
    const draft: PersistedSpatialDraft = {
      depthMaps,
      metricLocks,
      consistencyResult,
    };

    try {
      window.localStorage.setItem(SPATIAL_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors.
    }
  }, [consistencyResult, depthMaps, metricLocks]);

  const setDepthMap = useCallback((depthMap: DepthMap) => {
    setDepthMaps((prev) => ({ ...prev, [depthMap.sceneId]: depthMap }));
  }, []);

  const setMetricLock = useCallback((metricLock: MetricLock) => {
    setMetricLocks((prev) => ({ ...prev, [metricLock.sceneId]: metricLock }));
  }, []);

  const lockScene = useCallback((sceneId: string) => {
    setMetricLocks((prev) => {
      const existing = prev[sceneId];
      if (!existing) return prev;
      return { ...prev, [sceneId]: { ...existing, isLocked: true } };
    });
  }, []);

  const setConsistencyResult = useCallback((result: ConsistencyResult) => {
    setConsistencyResultState(result);
  }, []);

  const allScenesLocked = useMemo(() => {
    const locks = Object.values(metricLocks);
    return locks.length > 0 && locks.every((lock) => lock.isLocked);
  }, [metricLocks]);

  const resetSpatial = useCallback(() => {
    setDepthMaps({});
    setMetricLocks({});
    setConsistencyResultState(null);
    setIsGenerating(false);

    try {
      window.localStorage.removeItem(SPATIAL_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const value = useMemo<SpatialContextValue>(
    () => ({
      depthMaps,
      metricLocks,
      consistencyResult,
      isGenerating,
      allScenesLocked,
      setDepthMap,
      setMetricLock,
      lockScene,
      setConsistencyResult,
      setIsGenerating,
      resetSpatial,
    }),
    [
      depthMaps,
      metricLocks,
      consistencyResult,
      isGenerating,
      allScenesLocked,
      setDepthMap,
      setMetricLock,
      lockScene,
      setConsistencyResult,
      resetSpatial,
    ],
  );

  return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
}

export function useSpatialContext() {
  const context = useContext(SpatialContext);
  if (!context) {
    throw new Error("useSpatialContext must be used within a SpatialProvider.");
  }
  return context;
}
