"use client";

import { Fragment, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { Sparkles, AlertCircle, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import { fadeInDown, fadeInUp } from "../lib/animation-variants";
import { useTranslations } from "next-intl";
import {
  TOOLS,
  TOOL_CATEGORIES,
  COMING_SOON,
  COMING_SOON_DISPLAY_NAMES,
  CREDIT_TO_TL_RATE,
} from "../constants";
import type { ToolCategoryId, ToolConfig } from "../types";
import AiStudioCategorySection from "./ai-studio-category-section";
import AiStudioComingSoonCard from "./ai-studio-coming-soon-card";

interface AiStudioToolRailProps {
  selectedTool: ToolConfig | null;
  onSelectTool: (tool: ToolConfig) => void;
  hasActiveJobInFlight: boolean;
}

export default function AiStudioToolRail({
  selectedTool,
  onSelectTool,
  hasActiveJobInFlight,
}: AiStudioToolRailProps) {
  const t = useTranslations("dashboard.aiStudio");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | ToolCategoryId>("all");

  const categoryFilterChips: Array<{ id: "all" | ToolCategoryId; labelKey: string }> = [
    { id: "all", labelKey: "filterAll" },
    { id: "render", labelKey: "filterRender" },
    { id: "analyze", labelKey: "filterAnalyze" },
    { id: "present", labelKey: "filterPresent" },
  ];

  const filteredCategoryGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");

    return TOOL_CATEGORIES.map((category) => {
      const categoryLabel = t(category.labelKey).toLocaleLowerCase("tr-TR");
      const categoryMatchesSearch =
        !normalizedSearch ||
        category.id.toLocaleLowerCase("tr-TR").includes(normalizedSearch) ||
        categoryLabel.includes(normalizedSearch);

      const tools = TOOLS.filter((tool) => {
        if (selectedCategory !== "all" && tool.category !== selectedCategory) {
          return false;
        }

        if (tool.category !== category.id) {
          return false;
        }

        if (!normalizedSearch || categoryMatchesSearch) {
          return true;
        }

        const toolLabel = t(`tools.${tool.id}.label`).toLocaleLowerCase("tr-TR");
        const toolBenefit = t(`toolBenefits.${tool.id}`).toLocaleLowerCase("tr-TR");

        return toolLabel.includes(normalizedSearch) || toolBenefit.includes(normalizedSearch);
      });

      return { category, tools };
    }).filter((group) => group.tools.length > 0);
  }, [searchTerm, selectedCategory, t]);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Active job blocking explanation */}
      {hasActiveJobInFlight && (
        <motion.div
          variants={fadeInDown}
          initial="hidden"
          animate="visible"
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-sm bg-primary/5 border border-primary/15"
        >
          <AlertCircle className="w-3.5 h-3.5 text-primary/60 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mb-0.5">
              {t("jobBlockedTitle")}
            </p>
            <p className="text-[9px] text-gray-500 font-sans leading-relaxed">
              {t("jobBlockedDesc")}
            </p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
        <div>
          <p className="text-primary text-[9px] uppercase tracking-[0.25em] font-sans font-bold">
            {t("eyebrow")}
          </p>
          <h2 className="text-sm font-serif text-white italic leading-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-[9px] font-sans leading-tight text-white/35">
            {t("workflowHint")}
          </p>
        </div>
      </div>

      {/* Search and quick filters */}
      <motion.div
        variants={fadeInDown}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary/45" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("toolSearchPlaceholder")}
            className="w-full rounded-sm border border-white/[0.06] bg-[#0a0c10]/80 py-2.5 pl-8 pr-3 text-[11px] font-sans text-gray-300 placeholder:text-gray-600 outline-none transition-all duration-200 focus:border-primary/30 focus:bg-primary/[0.03] focus:ring-1 focus:ring-primary/10"
          />
        </label>
        <div className="flex flex-wrap gap-1.5 px-0.5" aria-label={t("toolCategoryFilters")}> 
          {categoryFilterChips.map((chip) => {
            const isActive = selectedCategory === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedCategory(chip.id)}
                className={`rounded-sm border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.16em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/35 ${
                  isActive
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-white/[0.06] bg-white/[0.02] text-gray-500 hover:border-primary/20 hover:bg-primary/[0.04] hover:text-gray-300"
                }`}
              >
                {t(chip.labelKey)}
              </button>
            );
          })}
        </div>
      </motion.div>

{/* Category groups */}
      <div className="space-y-4">
        {filteredCategoryGroups.map(({ category, tools: categoryTools }, categoryIndex) => {
          const isLastCategory = categoryIndex === filteredCategoryGroups.length - 1;
          const workflowLabel =
            category.id === "render"
              ? t("flowToAnalyze")
              : category.id === "analyze"
                ? t("flowToPresent")
                : null;
          return (
            <Fragment key={category.id}>
              <AiStudioCategorySection
                category={category}
                tools={categoryTools}
                selectedTool={selectedTool}
                onSelectTool={onSelectTool}
                hasActiveJobInFlight={hasActiveJobInFlight}
              />
              {!isLastCategory && workflowLabel && (
                <div className="flex flex-col items-center gap-1 py-1" aria-hidden="true">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                  <div className="flex items-center gap-2">
                    <motion.span
                      className="w-1 h-1 rounded-full bg-primary/40 flex-shrink-0"
                      animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.2, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      aria-hidden="true"
                    />
                    <p className="text-[6px] uppercase tracking-[0.22em] text-white/20">
                      {workflowLabel}
                    </p>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Coming Soon — Premium Roadmap Cards */}
      <div>
        <p className="text-[9px] text-gray-600 uppercase tracking-[0.2em] font-sans font-bold mb-3 px-1 flex items-center gap-2">
          <span>{t("comingSoon")}</span>
          <span className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
        </p>
        <div className="space-y-2">
          {COMING_SOON.map((tool, index) => {
            const displayName =
              COMING_SOON_DISPLAY_NAMES[tool.id] || tool.id;
            return (
              <AiStudioComingSoonCard
                key={tool.id}
                tool={tool}
                displayName={displayName}
                index={index}
              />
            );
          })}
        </div>
      </div>

      {/* Selected tool info card */}
      {selectedTool && (() => {
        const selectedToolTlValue = Math.round(selectedTool.credit * CREDIT_TO_TL_RATE);

        return (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className={`p-3 rounded-sm border ${selectedTool.accentBg} ${selectedTool.accentBorder}`}
        >
          <p
            className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${selectedTool.accentColor}`}
          >
            {t(`tools.${selectedTool.id}.label`)}
          </p>
          <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
            {t(`toolBenefits.${selectedTool.id}`)}
          </p>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
            <Sparkles className={`w-2.5 h-2.5 ${selectedTool.accentColor}`} />
            <p className={`text-[9px] font-bold ${selectedTool.accentColor}`}>
              {selectedTool.credit} {t("creditUnit")} · {t("creditValue", { price: selectedToolTlValue })} · Archilya AI
            </p>
          </div>
        </motion.div>
      );
      })()}

      {/* Pricing link */}
      <div className="mt-auto pt-4 border-t border-white/[0.04]">
        <Link
          href="/abonelik"
          className="flex items-center justify-center gap-1 text-[9px] text-gray-600 hover:text-primary transition-colors font-sans"
        >
          Fiyatlandırmayı görüntüle
          <ChevronRight className="w-2.5 h-2.5" />
        </Link>
      </div>
    </div>
  );
}
