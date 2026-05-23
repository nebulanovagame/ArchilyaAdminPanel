"use client";

import { useTranslations } from "next-intl";
import { STYLES } from "../constants";

export default function StylePicker({ style, setStyle }: { style: string; setStyle: (nextStyle: string) => void }) {
  const t = useTranslations("dashboard.aiStudio");

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-5">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">{t("architecturalStyle")}</p>
      <div className="grid grid-cols-2 gap-2">
        {STYLES.map((styleOption) => (
          <button
            key={styleOption.id}
            onClick={() => setStyle(styleOption.id)}
            className={`flex items-center gap-2.5 p-2.5 rounded-sm border text-left transition-all ${style === styleOption.id ? `${styleOption.bg} ${styleOption.border} border` : "bg-white/3 border-white/5 hover:border-white/15"}`}
          >
            <span className="text-base leading-none">{styleOption.icon}</span>
            <span className={`text-[11px] font-bold ${style === styleOption.id ? styleOption.color : "text-gray-300"}`}>{t(`styles.${styleOption.id}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
