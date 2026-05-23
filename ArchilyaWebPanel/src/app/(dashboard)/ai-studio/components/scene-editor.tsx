"use client";

import { Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SCENE_EDIT_MODES } from "../constants";
import type { SceneReference } from "../types";

interface SceneEditorProps {
  sceneEditMode: string;
  onSceneEditModeChange: (mode: string) => void;
  sceneReferences: SceneReference[];
  onAddReference: (file: File) => void;
  onRemoveReference: (id: string) => void;
  sceneReferenceInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function SceneEditor({
  sceneEditMode,
  onSceneEditModeChange,
  sceneReferences,
  onAddReference,
  onRemoveReference,
  sceneReferenceInputRef,
}: SceneEditorProps) {
  const t = useTranslations("dashboard.aiStudio");

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t("editMode")}</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300 hover:border-cyan-300/40 transition-colors">
          <Upload className="w-3.5 h-3.5" /> {t("addReference")}
          <input ref={sceneReferenceInputRef} type="file" accept="image/*,.pdf" onChange={(event) => { if (event.target.files?.[0]) onAddReference(event.target.files[0]); event.target.value = ""; }} className="hidden" />
        </label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {SCENE_EDIT_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onSceneEditModeChange(mode.id)}
            className={`px-3 py-2 rounded-sm border text-[11px] font-bold uppercase tracking-wider text-left transition-all ${sceneEditMode === mode.id ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-300" : "bg-white/3 border-white/5 text-gray-400 hover:border-white/15"}`}
          >
            {t(`sceneModes.${mode.id}`)}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {sceneReferences.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-sm p-4 text-[11px] text-gray-500 text-center">
            {t("noSceneReference")}
          </div>
        ) : sceneReferences.map((reference) => (
          <div key={reference.id} className="flex items-center justify-between gap-3 rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-sans text-white truncate">{reference.label}</p>
              <p className="text-[10px] text-gray-500">{t("referenceImage")}</p>
            </div>
            <button onClick={() => onRemoveReference(reference.id)} className="text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
