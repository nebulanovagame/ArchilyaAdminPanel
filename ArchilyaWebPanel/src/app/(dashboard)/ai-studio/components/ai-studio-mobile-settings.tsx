"use client";

import { useRef, useState, type RefObject } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Settings2, X, Sparkles, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAiStudioSettings } from "../hooks/use-ai-studio-settings";
import {
  TOOL_SETTINGS,
  REVISION_TYPES,
} from "../constants";
import type { ToolConfig, SettingsField, SceneReference } from "../types";
import AiStudioFieldRenderer from "./ai-studio-field-renderer";
import { fadeIn, fastTransition, snapTransition } from "../lib/animation-variants";

interface AiStudioMobileSettingsProps {
  selectedTool: ToolConfig;
  hasHiddenResult?: boolean;
  lastResultToolLabel?: string | null;
  /** Scene reference upload — wired from parent useAiStudioFileInput */
  onAddSceneReference?: (file: File) => void;
  onRemoveSceneReference?: (id: string) => void;
  sceneReferences?: SceneReference[];
  sceneReferenceInputRef?: RefObject<HTMLInputElement | null>;
}

const slideUp: Variants = {
  hidden: { y: 500, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: snapTransition,
  },
  exit: {
    y: 500,
    opacity: 0,
    transition: fastTransition,
  },
};

/**
 * Mobile bottom sheet for all tool-specific settings.
 * Mirrors desktop settings panel fields with mobile-adapted UX.
 * All settings share the same AiStudioSettingsProvider context.
 */
export default function AiStudioMobileSettings({
  selectedTool,
  hasHiddenResult = false,
  lastResultToolLabel = null,
  onAddSceneReference,
  onRemoveSceneReference,
  sceneReferences = [],
  sceneReferenceInputRef,
}: AiStudioMobileSettingsProps) {
  const t = useTranslations("dashboard.aiStudio");
  const settings = useAiStudioSettings();
  const [isOpen, setIsOpen] = useState(false);

  const settingsConfig = TOOL_SETTINGS[selectedTool.id];
  if (!settingsConfig) return null;

  const hasSettings = settingsConfig.fields.length > 0;
  if (!hasSettings) return null;

  // ── Field renderer ─────────────────────────────────────────────
  function renderField(field: SettingsField) {
    switch (field.type) {
      case "sceneMode":
        return (
          <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
              {t("revisionTypesTitle")}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {REVISION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => settings.setRevisionType(type.id)}
                  className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-left transition-all ${
                    settings.revisionType === type.id
                      ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-300"
                      : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
                  }`}
                >
                  {t(`revisionTypes.${type.id}`)}
                </button>
              ))}
            </div>
          </div>
        );
  
      case "referenceImage":
        return (
          <AiStudioFieldRenderer
            key={`${field.type}:${field.labelKey}:${field.placeholderKey ?? ""}`}
            field={field}
            settings={settings}
            onAddSceneReference={onAddSceneReference}
            sceneReferenceInputRef={sceneReferenceInputRef}
            sceneReferences={sceneReferences}
            onRemoveSceneReference={onRemoveSceneReference}
          />
        );
  
      default:
        return (
          <AiStudioFieldRenderer
            key={`${field.type}:${field.labelKey}:${field.placeholderKey ?? ""}`}
            field={field}
            settings={settings}
          />
        );
    }
  }

  const fields = settingsConfig.fields;
  const configuredFieldCount = fields.length;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-[#1a1c23] shadow-[0_0_18px_rgba(198,168,124,0.08)] transition-colors hover:bg-[#22242b]"
        aria-label={t("settings")}
      >
        <Settings2 className="w-4.5 h-4.5 text-primary/80" />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#0a0c10] bg-primary px-1 text-[9px] font-black leading-none text-black">
          {configuredFieldCount}
        </span>
      </button>

      {/* Overlay + Bottom Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobile-settings-overlay"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm xl:hidden"
            />

            {/* Bottom Sheet */}
            <motion.div
              key="mobile-settings-sheet"
              variants={slideUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-0 left-0 right-0 z-[100] xl:hidden bg-[#0a0c10] border-t border-white/[0.06] rounded-t-xl max-h-[60vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="sticky top-0 z-10 bg-[#0a0c10] border-b border-white/[0.06]">
                <div className="flex justify-center pt-2">
                  <span className="h-1 w-11 rounded-full bg-white/15" aria-hidden="true" />
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {t("settings")}
                    </span>
                    <span className="rounded-sm border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[8px] font-bold text-primary">
                      {configuredFieldCount}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Settings content — dynamic per tool */}
              <div className="p-4 space-y-3">
                {fields.map((field) => renderField(field))}
              </div>

              {hasHiddenResult && (
                <div className="sticky bottom-0 border-t border-amber-300/15 bg-[#0a0c10]/95 px-4 py-2 backdrop-blur-sm">
                  <div className="h-0.5 w-full rounded-full bg-amber-300/25" />
                  <p className="mt-2 truncate text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300/80">
                    {t("sessionLastJobStatus", { tool: lastResultToolLabel || t("sessionHiddenResult") })}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
