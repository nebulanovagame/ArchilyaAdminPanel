"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { fadeInRight, expandCollapse } from "../lib/animation-variants";
import {
  Sparkles,
  Upload,
  X,
  ChevronDown,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  TOOL_SETTINGS,
  REVISION_TYPES,
  CREDIT_TO_TL_RATE,
} from "../constants";
import type {
  ToolConfig,
  SceneReference,
  SettingsField,
  SettingsFieldType,
  ToolId,
} from "../types";
import { useAiStudioSettings } from "../hooks/use-ai-studio-settings";
import AiStudioGenerateBar from "./ai-studio-generate-bar";
import AiStudioFieldRenderer from "./ai-studio-field-renderer";

// ── Field classification: basic vs advanced ──────────────────
const ADVANCED_FIELD_TYPES = new Set(["checklist", "infoNote"]);
const BASIC_FIELD_TYPES = new Set([
  "style", "sceneMode", "referenceImage", "textarea",
  "atmosphere", "material", "styleStrength",
  "planType", "palette", "roomLabels", "presentationStyle", "reportTone",
]);

type FieldMatcher = {
  type: SettingsFieldType;
  labelKey?: string;
};

type BasicFieldGroup = {
  title?: string;
  fields: FieldMatcher[];
};

type ToolFieldLayout = {
  basic: BasicFieldGroup[];
  advanced: FieldMatcher[];
};

const TOOL_FIELD_LAYOUTS: Record<ToolId, ToolFieldLayout> = {
  img2img: {
    basic: [
      { title: "groupStyle", fields: [{ type: "style" }] },
      {
        title: "groupAtmosphereMaterial",
        fields: [{ type: "atmosphere" }, { type: "material" }],
      },
      { title: "groupNote", fields: [{ type: "textarea" }] },
    ],
    advanced: [],
  },
  enhance: {
    basic: [
      { title: "groupStyleStrength", fields: [{ type: "styleStrength" }] },
      { title: "groupNote", fields: [{ type: "textarea" }] },
    ],
    advanced: [{ type: "checklist", labelKey: "preserveElements" }],
  },
  sceneedit: {
    basic: [
      {
        title: "groupSceneEdit",
        fields: [{ type: "sceneMode" }, { type: "referenceImage" }],
      },
      { title: "groupNote", fields: [{ type: "textarea" }] },
    ],
    advanced: [{ type: "checklist", labelKey: "preserveAreas" }],
  },
  "multi-angle": {
    basic: [
      {
        title: "groupSourceImage",
        fields: [{ type: "referenceImage", labelKey: "multiAnglePreviousRender" }],
      },
      { title: "groupNote", fields: [{ type: "textarea" }] },
    ],
    advanced: [
      { type: "checklist", labelKey: "multiAnglePreserve" },
      { type: "infoNote", labelKey: "multiAngleLiteInfo" },
    ],
  },
  plancolor: {
    basic: [
      { title: "groupPlanType", fields: [{ type: "planType" }] },
      {
        title: "groupPaletteLabel",
        fields: [{ type: "palette" }, { type: "roomLabels" }],
      },
      {
        title: "groupPresentation",
        fields: [{ type: "presentationStyle" }, { type: "textarea" }],
      },
    ],
    advanced: [],
  },
  analysis: {
    basic: [
      {
        title: "groupAnalysisFrame",
        fields: [{ type: "reportTone" }, { type: "textarea" }],
      },
    ],
    advanced: [{ type: "checklist", labelKey: "analysisFocus" }],
  },
};

function isMatchingField(field: SettingsField, matcher: FieldMatcher) {
  return field.type === matcher.type && (!matcher.labelKey || field.labelKey === matcher.labelKey);
}

function findMatchingField(fields: SettingsField[], matcher: FieldMatcher) {
  return fields.find((field) => isMatchingField(field, matcher)) ?? null;
}

interface AiStudioSettingsPanelProps {
  selectedTool: ToolConfig | null;
  sceneReferences: SceneReference[];
  onAddSceneReference: (file: File) => void;
  onRemoveSceneReference: (id: string) => void;
  sceneReferenceInputRef: React.RefObject<HTMLInputElement | null>;
  hasPrimarySource: boolean;
  hasRequiredSceneReferences: boolean;
  generating: boolean;
  credits: number | null;
  isFreePlan?: boolean;
  hasEnoughCredits: (amount: number) => boolean;
  onGenerate: () => void;
}

function AiStudioSettingsPanel({
  selectedTool,
  sceneReferences,
  onAddSceneReference,
  onRemoveSceneReference,
  sceneReferenceInputRef,
  hasPrimarySource,
  hasRequiredSceneReferences,
  generating,
  credits,
  isFreePlan,
  hasEnoughCredits,
  onGenerate,
}: AiStudioSettingsPanelProps) {
  const t = useTranslations("dashboard.aiStudio");
  const settings = useAiStudioSettings();
  const [advancedPanelState, setAdvancedPanelState] = useState<{
    toolId: ToolId | null;
    open: boolean;
  }>({
    toolId: null,
    open: false,
  });

  // ── Collapsible basic groups: which group index is expanded per tool ──
  // Default: first group (index 0) is expanded; last group (textarea) is always expanded.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, number>>({});

  // Reset collapsible groups when tool changes
  useEffect(() => {
    const timeout = setTimeout(() => setExpandedGroups({}), 0);
    return () => clearTimeout(timeout);
  }, [selectedTool?.id]);

  const toggleGroup = (toolId: string, groupIndex: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [toolId]: prev[toolId] === groupIndex ? -1 : groupIndex,
    }));
  };

  const isGroupExpanded = (toolId: string, groupIndex: number, totalGroups: number) => {
    // Last group (textarea) is always expanded
    if (groupIndex === totalGroups - 1) return true;
    // Default: first group expanded
    if (!(toolId in expandedGroups)) return groupIndex === 0;
    return expandedGroups[toolId] === groupIndex;
  };

  if (!selectedTool) return null;

  const showAdvanced =
    advancedPanelState.toolId === selectedTool.id && advancedPanelState.open;

  const settingsConfig = TOOL_SETTINGS[selectedTool.id];
  if (!settingsConfig) return null;

  const toolLayout = TOOL_FIELD_LAYOUTS[selectedTool.id];
  const matchedBasicGroups = toolLayout.basic
    .map((group) => ({
      ...group,
      fields: group.fields
        .map((matcher) => findMatchingField(settingsConfig.fields, matcher))
        .filter((field): field is SettingsField => field !== null),
    }))
    .filter((group) => group.fields.length > 0);

  const basicKeys = new Set(
    matchedBasicGroups.flatMap((group) =>
      group.fields.map((field) => `${field.type}:${field.labelKey ?? ""}`),
    ),
  );

  const advancedFields = settingsConfig.fields.filter((field) => {
    const fieldKey = `${field.type}:${field.labelKey ?? ""}`;

    if (basicKeys.has(fieldKey)) {
      return false;
    }

    const explicitlyAdvanced = toolLayout.advanced.some((matcher) =>
      isMatchingField(field, matcher),
    );

    if (explicitlyAdvanced) {
      return true;
    }

    return ADVANCED_FIELD_TYPES.has(field.type) && !BASIC_FIELD_TYPES.has(field.type);
  });
  const hasAdvanced = advancedFields.length > 0;
  const advancedSettingsLabel = t("advancedSettings");

  const canGenerate =
    hasPrimarySource &&
    hasRequiredSceneReferences &&
    !generating &&
    hasEnoughCredits(selectedTool.credit);

  // ── Field renderer ─────────────────────────────────────────────
  function renderSceneModeField(field: SettingsField) {
    return (
      <div
        key={field.type}
        className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3"
      >
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
        {/* Scene references */}
        <div className="mt-3 space-y-1.5">
          {sceneReferences.length === 0 ? (
            <div className="border border-dashed border-white/[0.06] rounded-sm p-3 text-[10px] text-gray-600 text-center">
              {t("noSceneReference")}
            </div>
          ) : (
            sceneReferences.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center justify-between gap-2 rounded-sm border border-white/[0.06] bg-white/[0.01] px-2.5 py-2"
              >
                <p className="text-[10px] font-sans text-gray-400 truncate">
                  {ref.label}
                </p>
                <button
                  onClick={() => onRemoveSceneReference(ref.id)}
                  className="text-gray-600 hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300 hover:border-cyan-400/30 transition-colors">
            <Upload className="w-3 h-3" /> {t("addReference")}
            <input
              ref={sceneReferenceInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => {
                if (event.target.files?.[0])
                  onAddSceneReference(event.target.files[0]);
                event.target.value = "";
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  const selectedToolTlValue = selectedTool.credit * CREDIT_TO_TL_RATE;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedTool.id}
        variants={fadeInRight}
        initial="hidden"
        animate="visible"
        exit={{ opacity: 0 }}
        className="flex flex-col h-full"
      >
        {/* Tool header */}
        <div className="mb-5 border-b border-white/[0.06] pb-5">
          <div className="mb-3 flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-sm border ${selectedTool.accentBg} ${selectedTool.accentBorder}`}
            >
              <selectedTool.icon
                className={`h-4 w-4 ${selectedTool.accentColor}`}
              />
            </div>
            <div>
              <h3
                className={`text-sm font-serif italic ${selectedTool.accentColor}`}
              >
                {t(`tools.${selectedTool.id}.label`)}
              </h3>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
            {t(`tools.${selectedTool.id}.desc`)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Sparkles
              className={`h-3 w-3 ${selectedTool.accentColor}`}
            />
            <span className={`text-[9px] font-bold ${selectedTool.accentColor}`}>
              {selectedTool.credit} {t("creditUnit")}
            </span>
            <span className={`text-[9px] ${selectedTool.accentColor}`}>
              {t("creditValue", { price: selectedToolTlValue })}
            </span>
            <span className="text-[9px] text-gray-700">·</span>
            <span className="text-[9px] text-gray-600">
              {selectedTool.outputType === "image"
                ? t("visualOutputType")
                : t("textOutputType")}
            </span>
          </div>
          {credits !== null && (
            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-gray-500">
              <span>{t("creditBalanceLabel", { balance: credits.toLocaleString("tr-TR") })}</span>
              <span className="text-gray-700">→</span>
              <span className={credits - selectedTool.credit >= 0 ? "text-emerald-400/80" : "text-red-400/80"}>
                {t("creditAfterLabel", { remaining: Math.max(0, credits - selectedTool.credit).toLocaleString("tr-TR") })}
              </span>
              <span className="relative group cursor-help ml-1" title={t("creditInfoTooltip")} aria-label={t("creditInfoTooltip")}>
                <Info className="w-2.5 h-2.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </span>
            </div>
          )}
          {isFreePlan === true && selectedTool.isSignature && (
            <span className="text-[8px] text-gray-700 mt-1 block">
              Bu araç öne çıkan bir araçtır. <Link href="/abonelik" className="text-gray-500 transition-colors hover:text-primary">Planınızı yükselterek kullanabilirsiniz.</Link>
            </span>
          )}
        </div>

        {/* Settings fields — scrollable area */}
        <div className="flex-1 space-y-5 overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
          {/* ── Basic fields (collapsible groups) ──────────────────────── */}
          {matchedBasicGroups.map((group, groupIndex) => {
            const isLastGroup = groupIndex === matchedBasicGroups.length - 1;
            const expanded = isGroupExpanded(selectedTool.id, groupIndex, matchedBasicGroups.length);
            const isCollapsible = !isLastGroup;

            return (
              <div
                key={`${selectedTool.id}-group-${groupIndex}`}
                className="space-y-3"
              >
                {groupIndex > 0 && (
                  <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                )}
                {group.title ? (
                  isCollapsible ? (
                    <button
                      onClick={() => toggleGroup(selectedTool.id, groupIndex)}
                      className="flex w-full items-center justify-between pt-1 text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans transition-colors hover:text-gray-300"
                    >
                      {t(group.title)}
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  ) : (
                      <p className="pt-1 text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans">
                      {t(group.title)}
                    </p>
                  )
                ) : null}
                {isCollapsible ? (
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        variants={expandCollapse}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="space-y-3 overflow-hidden"
                      >
                        {group.fields.map((field) => (
                          field.type === "sceneMode" ? (
                            renderSceneModeField(field)
                          ) : (
                            <AiStudioFieldRenderer
                              key={`${field.type}:${field.labelKey}:${field.placeholderKey ?? ""}`}
                              field={field}
                              settings={settings}
                              sceneReferences={sceneReferences}
                              onAddSceneReference={onAddSceneReference}
                              onRemoveSceneReference={onRemoveSceneReference}
                              sceneReferenceInputRef={sceneReferenceInputRef}
                            />
                          )
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                ) : (
                  <div className="space-y-3">
                    {group.fields.map((field) => (
                      field.type === "sceneMode" ? (
                        renderSceneModeField(field)
                      ) : (
                        <AiStudioFieldRenderer
                          key={`${field.type}:${field.labelKey}:${field.placeholderKey ?? ""}`}
                          field={field}
                          settings={settings}
                          sceneReferences={sceneReferences}
                          onAddSceneReference={onAddSceneReference}
                          onRemoveSceneReference={onRemoveSceneReference}
                          sceneReferenceInputRef={sceneReferenceInputRef}
                        />
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Advanced fields (collapsible) ─────────────────────── */}
          {hasAdvanced && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <button
                 onClick={() =>
                   setAdvancedPanelState((current) => ({
                     toolId: selectedTool.id,
                     open:
                       current.toolId === selectedTool.id ? !current.open : true,
                   }))
                 }
                  className="flex w-full items-center justify-between rounded-sm border border-white/[0.06] bg-white/[0.01] px-3 py-2 text-[9px] uppercase tracking-wider font-bold text-gray-500 transition-all hover:bg-white/[0.02]"
               >
                 {advancedSettingsLabel}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {showAdvanced && (
                  <motion.div
                    variants={expandCollapse}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    className="space-y-3 overflow-hidden"
                  >
                    {advancedFields.map((field) => (
                      <AiStudioFieldRenderer
                        key={`${field.type}:${field.labelKey}:${field.placeholderKey ?? ""}`}
                        field={field}
                        settings={settings}
                        sceneReferences={sceneReferences}
                        onAddSceneReference={onAddSceneReference}
                        onRemoveSceneReference={onRemoveSceneReference}
                        sceneReferenceInputRef={sceneReferenceInputRef}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Generate bar — sticky at bottom with glass effect */}
        <div className="sticky bottom-0 -mx-4 mt-5 border-t border-white/[0.06] bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/95 to-transparent px-4 pb-0 pt-4">
          <AiStudioGenerateBar
            selectedTool={selectedTool}
            canGenerate={canGenerate}
            generating={generating}
            credits={credits}
            hasEnoughCredits={hasEnoughCredits}
            onGenerate={onGenerate}
            variant="panel"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default AiStudioSettingsPanel;
