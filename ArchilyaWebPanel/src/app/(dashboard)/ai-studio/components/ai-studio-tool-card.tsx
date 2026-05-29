"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { fadeInLeft } from "../lib/animation-variants";
import { useTranslations } from "next-intl";
import type { ToolConfig } from "../types";

interface AiStudioToolCardProps {
  tool: ToolConfig;
  index: number;
  isActive: boolean;
  disabled: boolean;
  onSelect: (tool: ToolConfig) => void;
}

export default function AiStudioToolCard({
  tool,
  index,
  isActive,
  disabled,
  onSelect,
}: AiStudioToolCardProps) {
  const t = useTranslations("dashboard.aiStudio");
  const Icon = tool.icon;

  return (
    <motion.button
      key={tool.id}
      variants={fadeInLeft}
      initial="hidden"
      animate="visible"
      custom={index}
      transition={{ delay: index * 0.04 }}
      disabled={disabled}
      onClick={() => onSelect(tool)}
      className={`group relative w-full text-left flex items-center gap-2.5 p-2.5 rounded-sm border transition-all duration-200 ${
        isActive
          ? `${tool.accentBg} ${tool.accentBorder} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]`
          : tool.isSignature
            ? "bg-[#0d0f13] border border-primary/10 hover:border-primary/30 hover:bg-primary/[0.02]"
            : "bg-[#0d0f13] border border-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.02]"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {tool.isSignature && isActive && (
        <div className="absolute left-0 top-2 bottom-2 w-px bg-primary/45" />
      )}

      <div
        className={`relative rounded-sm flex items-center justify-center flex-shrink-0 overflow-hidden ${
          isActive
            ? `${tool.accentBg} border ${tool.accentBorder}`
            : tool.isSignature
              ? "bg-primary/5 border border-primary/15 group-hover:bg-primary/10"
              : "bg-white/5 border border-white/[0.06]"
        } ${tool.isSignature && isActive ? "w-8 h-8" : "w-7 h-7"}`}
      >
        {/* Signature icon subtle glow */}
        {tool.isSignature && isActive && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        )}
        <Icon
          className={`relative w-3.5 h-3.5 ${
            isActive ? tool.accentColor : tool.isSignature ? "text-primary/60 group-hover:text-primary/80" : "text-gray-500"
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-[11px] font-sans font-semibold tracking-wide ${
              isActive
                ? tool.isSignature
                  ? "text-white"
                  : "text-white"
                : tool.isSignature
                  ? "text-gray-300"
                  : "text-gray-400"
            }`}
          >
            {t(`tools.${tool.id}.label`)}
          </p>
          {tool.isSignature && (
            <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
              isActive
                ? "bg-primary/80 shadow-[0_0_6px_rgba(198,168,124,0.28)]"
                : "bg-primary/35 group-hover:bg-primary/55"
            }`} aria-label={t("signatureBadge")} />
          )}
        </div>
        <p
          className="text-[9px] text-gray-600 font-sans mt-[1px] leading-relaxed"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {t(`toolBenefits.${tool.id}`)}
        </p>
      </div>
      <ChevronRight
        className={`w-3 h-3 flex-shrink-0 transition-colors ${
          isActive ? tool.accentColor : tool.isSignature ? "text-primary/30" : "text-gray-700"
        }`}
      />
    </motion.button>
  );
}
