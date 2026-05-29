"use client";

import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComingSoonTool } from "../constants";

interface AiStudioComingSoonCardProps {
  tool: ComingSoonTool;
  displayName: string;
  index: number;
}

export default function AiStudioComingSoonCard({
  tool,
  displayName,
  index,
}: AiStudioComingSoonCardProps) {
  const t = useTranslations("dashboard.aiStudio");
  const Icon = tool.icon;

  return (
    <motion.div
      key={tool.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.06 }}
      className="group relative w-full flex items-center gap-3 p-2.5 rounded-sm border border-white/[0.04] bg-gradient-to-r from-white/[0.01] to-transparent hover:border-white/[0.08] hover:from-white/[0.02] transition-all duration-300 cursor-default"
    >
      {/* Premium disabled icon area */}
      <div className="relative w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/[0.02]" />
        <Icon className="w-3.5 h-3.5 text-gray-500/60 group-hover:text-gray-400/80 transition-colors relative z-10" />
      </div>

      {/* Tool name */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-sans font-medium text-gray-500/80 group-hover:text-gray-400 transition-colors tracking-wide">
          {displayName}
        </p>
      </div>

      {/* Premium badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[7px] font-bold uppercase tracking-[0.15em] text-gray-600/80 border border-white/[0.06] px-2 py-0.5 rounded-[2px] bg-white/[0.02] group-hover:border-primary/20 group-hover:text-primary/50 transition-all duration-300">
          {t("comingSoonBadge")}
        </span>
        <Clock className="w-2.5 h-2.5 text-gray-600/50 group-hover:text-gray-500/70 transition-colors" />
      </div>

      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent" />
      </div>
    </motion.div>
  );
}
