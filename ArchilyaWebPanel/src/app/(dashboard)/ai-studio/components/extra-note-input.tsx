"use client";

import { useTranslations } from "next-intl";

export default function ExtraNoteInput({ value, onChange, placeholder }: { value: string; onChange: (nextValue: string) => void; placeholder: string }) {
  const t = useTranslations("dashboard.aiStudio");

  return (
    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-5">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">{t("extraNote")}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors resize-none font-sans"
      />
    </div>
  );
}
