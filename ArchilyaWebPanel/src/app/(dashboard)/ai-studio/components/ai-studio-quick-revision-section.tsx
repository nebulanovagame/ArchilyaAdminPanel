"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  FileEdit,
  Grid3x3,
  Layers,
  MessageSquareText,
  Send,
  Sofa,
  Square,
  Sun,
} from "lucide-react";

import { REVISION_TYPES } from "../constants";
import { expandCollapse } from "../lib/animation-variants";

interface AiStudioQuickRevisionSectionProps {
  onReviseWithType: (revisionType: string) => void;
  onReviseWithNote: (note: string) => void;
  generating: boolean;
}

export default function AiStudioQuickRevisionSection({
  onReviseWithType,
  onReviseWithNote,
  generating,
}: AiStudioQuickRevisionSectionProps) {
  const t = useTranslations("dashboard.aiStudio");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const revisionIconMap: Record<string, ComponentType<{ className?: string }>> = {
    ceiling: Grid3x3,
    lighting: Sun,
    material: Layers,
    furniture: Sofa,
    floor: Square,
  };
  const quickRevisionChips = [
    ...REVISION_TYPES.filter((type) => type.id !== "general").map((type) => ({
      id: type.id,
      label: t(`revisionTypes.${type.id}`),
      icon: revisionIconMap[type.id] || FileEdit,
      featured: false,
    })),
    {
      id: "general",
      label: t("generalClientNote"),
      icon: FileEdit,
      featured: true,
    },
  ];

  return (
    <div className="px-4 pb-3">
      <div className="rounded-sm border border-cyan-300/15 bg-gradient-to-b from-cyan-300/[0.03] to-[#0a0c10] p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-sm bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <FileEdit className="w-3 h-3 text-cyan-300" />
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-200">
            {t("quickRevisionTitle")}
          </p>
        </div>
        <p className="mb-3 text-[10px] leading-relaxed text-gray-400">
          {t("quickRevisionDesc")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {quickRevisionChips.map((chip) => {
            const Icon = chip.icon;

            return (
              <button
                key={chip.id}
                onClick={() => {
                  if (chip.id === "general") {
                    setShowNoteInput(true);
                  } else {
                    onReviseWithType(chip.id);
                  }
                }}
                disabled={generating}
                className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[9px] font-medium tracking-wide transition-all duration-200 disabled:opacity-40 hover:-translate-y-[0.5px] active:scale-[0.97] ${
                  chip.featured
                    ? "border-primary/25 bg-primary/[0.06] text-primary/85 hover:border-primary/40 hover:bg-primary/[0.08] hover:text-white"
                    : "border-white/[0.08] bg-white/[0.02] text-gray-400 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06] hover:text-white"
                }`}
              >
                <Icon
                  className={`h-3 w-3 ${
                    chip.featured ? "text-primary/80" : "text-cyan-200/80"
                  }`}
                />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Müşteri Notu Inline Textarea */}
        {showNoteInput && (
          <motion.div
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="mt-3 overflow-hidden"
          >
            <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareText className="w-3.5 h-3.5 text-primary/60" />
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  {t("clientNote")}
                </p>
              </div>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder={t("clientNotePlaceholder")}
                rows={4}
                className="w-full bg-white/5 border border-white/[0.08] rounded-sm px-2.5 py-2 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-primary/40 transition-colors resize-none font-sans mb-2"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNoteInput(false);
                    setCustomerNote("");
                  }}
                  className="px-2.5 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    onReviseWithNote(customerNote);
                    setShowNoteInput(false);
                    setCustomerNote("");
                  }}
                  disabled={!customerNote.trim() || generating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-cyan-300/25 bg-cyan-300/[0.06] text-[9px] font-bold uppercase tracking-wider text-cyan-200 hover:bg-cyan-300/[0.1] hover:border-cyan-300/40 transition-all disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                  {t("startRevision")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
