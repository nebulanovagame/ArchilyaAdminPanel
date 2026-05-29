"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { STYLES, resolveStyleIcon } from "../constants";

interface AiStudioStylePickerProps {
  style: string;
  onStyleChange: (styleId: string) => void;
}

export default function AiStudioStylePicker({
  style,
  onStyleChange,
}: AiStudioStylePickerProps) {
  const t = useTranslations("dashboard.aiStudio");

  return (
    <div>
      <p className="text-[9px] text-gray-500 uppercase tracking-[0.2em] font-sans font-bold mb-3">
        {t("architecturalStyle")}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {STYLES.map((styleOption) => {
          const Icon = resolveStyleIcon(styleOption.iconName);
          const isSelected = style === styleOption.id;
          const selectedShadow = `0 0 0 1px ${styleOption.swatch}1f, 0 10px 28px -18px ${styleOption.swatch}80`;

          return (
            <button
              key={styleOption.id}
              onClick={() => onStyleChange(styleOption.id)}
              className={`group relative flex items-center gap-3 p-2.5 rounded-sm border overflow-hidden transition-all duration-200 ${
                isSelected
                  ? `${styleOption.accentBg} ${styleOption.accentBorder} border scale-[1.02] shadow-lg`
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.05] hover:-translate-y-[0.5px] hover:shadow-sm"
              }`}
              style={isSelected ? { boxShadow: selectedShadow } : undefined}
            >
              {isSelected && (
                <div className="pointer-events-none absolute inset-0 rounded-sm bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
              )}

              {/* Material texture overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-60 pointer-events-none" />

              {/* Subtle breathing glow on selected */}
              {isSelected && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-sm"
                  animate={{ opacity: [0, 0.12, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute inset-[1px] rounded-sm bg-gradient-to-br from-primary/20 to-transparent" />
                </motion.div>
              )}

              {/* Selected indicator line */}
              {isSelected && (
                <div className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              )}

              {/* Check mark for selected */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                  <span className="block w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(198,168,124,0.5)]" />
                  <Check className="w-2.5 h-2.5 text-primary/80" />
                </div>
              )}

              {/* Color swatch */}
              <div
                className={`relative w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 border transition-all duration-150 ${
                  isSelected
                    ? styleOption.accentBorder
                    : "border-white/[0.08]"
                }`}
                style={{
                  backgroundColor: isSelected
                    ? `${styleOption.swatch}20`
                    : "rgba(255,255,255,0.03)",
                }}
              >
                {isSelected && (
                  <div
                    className="absolute inset-0 rounded-sm opacity-70"
                    style={{
                      background: `linear-gradient(135deg, ${styleOption.swatch}26 0%, transparent 100%)`,
                    }}
                  />
                )}
                <Icon
                  className={`relative w-3.5 h-3.5 transition-colors ${
                    isSelected
                      ? styleOption.accentColor
                      : "text-gray-500 group-hover:text-gray-400"
                  }`}
                />
              </div>

{/* Label */}
              <span
                className={`relative text-[11px] font-sans font-semibold tracking-[0.015em] leading-snug text-left ${
                  isSelected
                    ? styleOption.accentColor
                    : "text-gray-300 group-hover:text-gray-200"
                }`}
              >
                {styleOption.label}
              </span>

              {/* Selected breathing glow */}
              {isSelected && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-sm"
                  animate={{ opacity: [0, 0.15, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute inset-[1px] rounded-sm bg-gradient-to-br from-primary/20 to-transparent" />
                </motion.div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
