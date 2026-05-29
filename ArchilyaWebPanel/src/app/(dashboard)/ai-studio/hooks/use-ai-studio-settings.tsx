"use client";

import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";

import { buildDefaultResetState } from "../lib/clear-state-helpers";

// ── Types ────────────────────────────────────────────────────

export type AiStudioSettingsState = {
  style: string;
  revisionType: string;
  extraNote: string;
  atmosphere: string;
  materialLanguage: string;
  styleStrength: string;
  enhancePreserve: string[];
  scenePreserveAreas: string[];
  planType: string;
  palette: string;
  roomLabels: boolean;
  presentationStyle: string;
  reportTone: string;
  analysisFocus: string[];
  multiAnglePreserve: string[];
};

export type AiStudioSettingsSetters = {
  setStyle: (v: string) => void;
  setRevisionType: (v: string) => void;
  setExtraNote: (v: string) => void;
  setAtmosphere: (v: string) => void;
  setMaterialLanguage: (v: string) => void;
  setStyleStrength: (v: string) => void;
  setEnhancePreserve: (v: string[]) => void;
  setScenePreserveAreas: (v: string[]) => void;
  setPlanType: (v: string) => void;
  setPalette: (v: string) => void;
  setRoomLabels: (v: boolean) => void;
  setPresentationStyle: (v: string) => void;
  setReportTone: (v: string) => void;
  setAnalysisFocus: (v: string[]) => void;
  setMultiAnglePreserve: (v: string[]) => void;
};

export type AiStudioSettingsContextValue = AiStudioSettingsState & AiStudioSettingsSetters & {
  resetToDefaults: () => void;
};

type Action =
  | { type: "set"; key: keyof AiStudioSettingsState; value: AiStudioSettingsState[keyof AiStudioSettingsState] }
  | { type: "reset"; defaults: AiStudioSettingsState };

function settingsReducer(state: AiStudioSettingsState, action: Action): AiStudioSettingsState {
  switch (action.type) {
    case "set": {
      if (state[action.key] === action.value) return state;
      return { ...state, [action.key]: action.value };
    }
    case "reset":
      return { ...action.defaults };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────

const AiStudioSettingsContext = createContext<AiStudioSettingsContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function AiStudioSettingsProvider({ children }: { children: ReactNode }) {
  const defaults = buildDefaultResetState();
  const [state, dispatch] = useReducer(settingsReducer, defaults);

  const setField = useCallback(
    <K extends keyof AiStudioSettingsState>(key: K, value: AiStudioSettingsState[K]) => {
      dispatch({ type: "set", key, value });
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    dispatch({ type: "reset", defaults: buildDefaultResetState() });
  }, []);

  const value = useMemo<AiStudioSettingsContextValue>(
    () => ({
      ...state,
      setStyle: (v: string) => setField("style", v),
      setRevisionType: (v: string) => setField("revisionType", v),
      setExtraNote: (v: string) => setField("extraNote", v),
      setAtmosphere: (v: string) => setField("atmosphere", v),
      setMaterialLanguage: (v: string) => setField("materialLanguage", v),
      setStyleStrength: (v: string) => setField("styleStrength", v),
      setEnhancePreserve: (v: string[]) => setField("enhancePreserve", v),
      setScenePreserveAreas: (v: string[]) => setField("scenePreserveAreas", v),
      setPlanType: (v: string) => setField("planType", v),
      setPalette: (v: string) => setField("palette", v),
      setRoomLabels: (v: boolean) => setField("roomLabels", v),
      setPresentationStyle: (v: string) => setField("presentationStyle", v),
      setReportTone: (v: string) => setField("reportTone", v),
      setAnalysisFocus: (v: string[]) => setField("analysisFocus", v),
      setMultiAnglePreserve: (v: string[]) => setField("multiAnglePreserve", v),
      resetToDefaults,
    }),
    [state, setField, resetToDefaults],
  );

  return (
    <AiStudioSettingsContext.Provider value={value}>
      {children}
    </AiStudioSettingsContext.Provider>
  );
}

// ── Consumer hook ────────────────────────────────────────────

/**
 * useAiStudioSettings
 *
 * Consumes the shared AI Studio settings context.
 * Provides all tool-specific parameter/settings state.
 * Pure UI state — no network, no side effects.
 *
 * MUST be used within <AiStudioSettingsProvider>.
 */
export function useAiStudioSettings(): AiStudioSettingsContextValue {
  const ctx = useContext(AiStudioSettingsContext);
  if (!ctx) {
    throw new Error(
      "useAiStudioSettings must be used within an <AiStudioSettingsProvider>. " +
      "Wrap your component tree with <AiStudioSettingsProvider>.",
    );
  }
  return ctx;
}
