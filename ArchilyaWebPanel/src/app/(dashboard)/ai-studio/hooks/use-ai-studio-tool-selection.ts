"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { TOOLS } from "../constants";
import type { PromptHistoryEntry, ToolConfig } from "../types";

/**
 * useAiStudioToolSelection
 *
 * Owns all tool-selection and editing-mode state.
 * revisionType is owned by AiStudioSettingsProvider (single source of truth).
 * No network, no polling, no result logic — pure UI state.
 */
export function useAiStudioToolSelection() {
  const t = useTranslations();

  const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);
  const [sceneEditMode, setSceneEditMode] = useState("scene-compose");

  const selectTool = useCallback((tool: ToolConfig) => {
    setSelectedTool(tool);
  }, []);

  const applyPromptHistory = useCallback(
    (entry: PromptHistoryEntry) => {
      const tool = TOOLS.find((item) => item.id === entry.toolId);
      if (!tool) return;

      selectTool(tool);
      if (entry.sceneEditMode) {
        requestAnimationFrame(() => {
          setSceneEditMode(entry.sceneEditMode);
        });
      }
      toast.success(t("dashboard.aiStudio.promptRestored"));
    },
    [selectTool, t],
  );

  return {
    selectedTool,
    sceneEditMode,
    setSelectedTool,
    setSceneEditMode,
    selectTool,
    applyPromptHistory,
  };
}
