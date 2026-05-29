"use client";

import type { RefObject } from "react";
import { Info, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  ATMOSPHERE_OPTIONS,
  MATERIAL_OPTIONS,
  PALETTE_OPTIONS,
  PLAN_TYPE_OPTIONS,
  PRESENTATION_STYLE_OPTIONS,
  REPORT_TONE_OPTIONS,
  STYLE_STRENGTH_OPTIONS,
} from "../constants";
import type { SceneReference, SettingsField } from "../types";
import type { AiStudioSettingsContextValue } from "../hooks/use-ai-studio-settings";
import AiStudioStylePicker from "./ai-studio-style-picker";

interface AiStudioFieldRendererProps {
  field: SettingsField;
  settings: AiStudioSettingsContextValue;
  sceneReferences?: SceneReference[];
  onAddSceneReference?: (file: File) => void;
  onRemoveSceneReference?: (id: string) => void;
  sceneReferenceInputRef?: RefObject<HTMLInputElement | null>;
}

export default function AiStudioFieldRenderer({
  field,
  settings,
  onAddSceneReference,
  sceneReferenceInputRef,
}: AiStudioFieldRendererProps) {
  const t = useTranslations("dashboard.aiStudio");
  const {
    style,
    extraNote,
    atmosphere,
    materialLanguage,
    styleStrength,
    analysisFocus,
    multiAnglePreserve,
    enhancePreserve,
    scenePreserveAreas,
    planType,
    palette,
    roomLabels,
    presentationStyle,
    reportTone,
    setStyle,
    setExtraNote,
    setAtmosphere,
    setMaterialLanguage,
    setStyleStrength,
    setAnalysisFocus,
    setMultiAnglePreserve,
    setEnhancePreserve,
    setScenePreserveAreas,
    setPlanType,
    setPalette,
    setRoomLabels,
    setPresentationStyle,
    setReportTone,
  } = settings;

  if (field.type === "style") {
    return (
      <div
        key={field.type}
        className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3"
      >
        <AiStudioStylePicker
          style={style}
          onStyleChange={setStyle}
        />
      </div>
    );
  }

  if (field.type === "referenceImage") {
    return (
      <div
        key={field.type}
        className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3"
      >
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2">
          {t(field.labelKey)}
        </p>
        <label className="flex items-center justify-center gap-2 border border-dashed border-white/[0.08] rounded-sm p-4 cursor-pointer hover:border-primary/30 transition-colors">
          <Upload className="w-4 h-4 text-gray-600" />
          <span className="text-[10px] text-gray-500">
            {t("chooseFile")}
          </span>
          <input
            ref={sceneReferenceInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(event) => {
              if (event.target.files?.[0])
                onAddSceneReference?.(event.target.files[0]);
              event.target.value = "";
            }}
            className="hidden"
          />
        </label>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div
        key={field.type + (field.placeholderKey || "")}
        className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3"
      >
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2">
          {t("extraNote")}
        </p>
        <textarea
          value={extraNote}
          onChange={(e) => setExtraNote(e.target.value)}
          placeholder={
            field.placeholderKey
              ? t(field.placeholderKey)
              : ""
          }
          rows={3}
          className="w-full bg-white/5 border border-white/[0.08] rounded-sm px-2.5 py-2 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 transition-colors resize-none font-sans"
        />
      </div>
    );
  }

  if (field.type === "checklist") {
    const isAnalysis = field.labelKey === "analysisFocus";
    const isMultiAngle = field.labelKey === "multiAnglePreserve";
    const isEnhancePreserve = field.labelKey === "preserveElements";
    const isScenePreserve = field.labelKey === "preserveAreas";
    let currentValues: string[];
    let onChange: (v: string[]) => void;
    if (isAnalysis) { currentValues = analysisFocus; onChange = setAnalysisFocus; }
    else if (isMultiAngle) { currentValues = multiAnglePreserve; onChange = setMultiAnglePreserve; }
    else if (isEnhancePreserve) { currentValues = enhancePreserve; onChange = setEnhancePreserve; }
    else if (isScenePreserve) { currentValues = scenePreserveAreas; onChange = setScenePreserveAreas; }
    else { currentValues = []; onChange = () => {}; }
    const toggleValue = (id: string) => {
      if (currentValues.includes(id)) {
        onChange(currentValues.filter((v) => v !== id));
      } else {
        onChange([...currentValues, id]);
      }
    };
    return (
      <div
        key={field.type + (field.labelKey || "")}
        className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3"
      >
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2">
          {t(field.labelKey)}
        </p>
        <div className="space-y-1.5">
          {field.options?.map((option) => {
            const isChecked = currentValues.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => toggleValue(option.id)}
              >
                <div className={`w-3.5 h-3.5 rounded-[2px] border transition-colors flex items-center justify-center ${
                  isChecked
                    ? "bg-primary/20 border-primary/50"
                    : "border-white/15 bg-white/[0.03] group-hover:border-primary/40"
                }`}>
                  {isChecked && (
                    <svg className="w-2.5 h-2.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={`text-[10px] transition-colors ${
                  isChecked ? "text-gray-200" : "text-gray-400 group-hover:text-gray-300"
                }`}>
                  {t(option.labelKey)}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Atmosphere selector ──
  if (field.type === "atmosphere") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("atmosphereTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {ATMOSPHERE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAtmosphere(opt.id)}
              className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-left transition-all ${
                atmosphere === opt.id
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Material language selector ──
  if (field.type === "material") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("materialTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {MATERIAL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMaterialLanguage(opt.id)}
              className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-left transition-all ${
                materialLanguage === opt.id
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Style strength selector ──
  if (field.type === "styleStrength") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("styleStrengthTitle")}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_STRENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setStyleStrength(opt.id)}
              className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-center transition-all ${
                styleStrength === opt.id
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Plan type selector ──
  if (field.type === "planType") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("planTypeTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PLAN_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPlanType(opt.id)}
              className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-left transition-all ${
                planType === opt.id
                  ? "bg-rose-400/10 border-rose-400/30 text-rose-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Palette selector ──
  if (field.type === "palette") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("paletteTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PALETTE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPalette(opt.id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition-all ${
                palette === opt.id
                  ? "bg-rose-400/10 border-rose-400/30 text-rose-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              <span
                className="w-3 h-3 rounded-[2px] flex-shrink-0 border border-white/10"
                style={{ backgroundColor: opt.hex }}
              />
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Room labels toggle ──
  if (field.type === "roomLabels") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("roomLabelsTitle")}
        </p>
        <button
          onClick={() => setRoomLabels(!roomLabels)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] transition-all w-full"
        >
          {roomLabels ? (
            <ToggleRight className="w-5 h-5 text-amber-400" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-gray-600" />
          )}
          <span className="text-[10px] text-gray-400 font-sans">
            {roomLabels ? t("roomLabelsEnabled") : t("roomLabelsDisabled")}
          </span>
        </button>
      </div>
    );
  }

  // ── Presentation style selector ──
  if (field.type === "presentationStyle") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("presentationStyleTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESENTATION_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPresentationStyle(opt.id)}
              className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-left transition-all ${
                presentationStyle === opt.id
                  ? "bg-rose-400/10 border-rose-400/30 text-rose-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Report tone selector ──
  if (field.type === "reportTone") {
    return (
      <div key={field.type} className="bg-white/[0.02] border border-white/[0.06] rounded-sm p-3">
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-2.5">
          {t("reportToneTitle")}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {REPORT_TONE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setReportTone(opt.id)}
              className={`px-2.5 py-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider text-left transition-all ${
                reportTone === opt.id
                  ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/15 hover:text-gray-400"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Info note (non-interactive) ──
  if (field.type === "infoNote") {
    return (
      <div
        key={field.type}
        className="flex items-start gap-2.5 px-3 py-2.5 rounded-sm bg-primary/5 border border-primary/15"
      >
        <Info className="w-3.5 h-3.5 text-primary/60 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
          {t(field.labelKey)}
        </p>
      </div>
    );
  }

  return null;
}
