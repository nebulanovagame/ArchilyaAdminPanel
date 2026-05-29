"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Check, X } from "lucide-react";
import { fadeInUp } from "../lib/animation-variants";
import { useTranslations } from "next-intl";

export default function ResultCard({ text, onClose }: { text: string; onClose: () => void }) {
  const t = useTranslations("dashboard.aiStudio");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-[#0d0f13] border border-emerald-400/20 rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-emerald-400/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-sans font-bold text-white uppercase tracking-widest">{t("analysisCompleted")}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-5 max-h-[520px] overflow-y-auto relative">
        {/* Architectural grid watermark */}
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(198, 168, 124, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(198, 168, 124, 0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="space-y-3 text-sm text-gray-300 font-sans leading-relaxed whitespace-pre-line">{text}</div>
      </div>
    </motion.div>
  );
}
