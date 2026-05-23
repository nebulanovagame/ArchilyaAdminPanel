"use client";

import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface PromptTemplatesProps {
  hasPrimarySource: boolean;
  selectedToolId: string | null;
  generating: boolean;
  onGenerateInspiration: () => void;
}

export default function PromptTemplates({
  hasPrimarySource,
  selectedToolId,
  generating,
  onGenerateInspiration,
}: PromptTemplatesProps) {
  const t = useTranslations("dashboard.aiStudio");
  const supportedTools = ["img2img", "enhance", "plancolor"];
  const isSupported = selectedToolId && supportedTools.includes(selectedToolId);
  const isDisabled = !hasPrimarySource || !isSupported || generating;

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="w-4 h-4 text-primary" />
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t("promptInspirationTitle")}</p>
      </div>
      <p className="text-xs text-gray-400 mb-4">{t("promptInspirationDescription")}</p>
      <button
        onClick={onGenerateInspiration}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-sm text-xs font-bold uppercase tracking-widest transition-all ${
          isDisabled
            ? "bg-white/5 text-gray-600 cursor-not-allowed"
            : "bg-primary/10 border border-primary/25 text-primary hover:border-primary/40"
        }`}
      >
        {generating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {t("promptInspirationLoading")}</>
        ) : (
          <><Sparkles className="w-4 h-4" /> {t("promptInspirationButton")}</>
        )}
      </button>
      {!hasPrimarySource && (
        <p className="mt-2 text-[10px] text-gray-600 text-center">{t("promptInspirationNeedImage")}</p>
      )}
      {hasPrimarySource && !isSupported && (
        <p className="mt-2 text-[10px] text-gray-600 text-center">{t("promptInspirationUnsupportedTool")}</p>
      )}
    </div>
  );
}
