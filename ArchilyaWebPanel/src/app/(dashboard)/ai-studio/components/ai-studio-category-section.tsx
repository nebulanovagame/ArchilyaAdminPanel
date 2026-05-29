"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import type { ToolConfig, ToolCategory } from "../types";
import AiStudioToolCard from "./ai-studio-tool-card";

interface AiStudioCategorySectionProps {
  category: ToolCategory;
  tools: ToolConfig[];
  selectedTool: ToolConfig | null;
  onSelectTool: (tool: ToolConfig) => void;
  hasActiveJobInFlight: boolean;
}

export default function AiStudioCategorySection({
  category,
  tools,
  selectedTool,
  onSelectTool,
  hasActiveJobInFlight,
}: AiStudioCategorySectionProps) {
  const t = useTranslations("dashboard.aiStudio");
  const showWorkflowCues = tools.length > 1;
  const categoryDescriptionKey = {
    render: "categoryRenderDesc",
    analyze: "categoryAnalyzeDesc",
    present: "categoryPresentDesc",
  }[category.id];

  if (tools.length === 0) return null;

  return (
    <div key={category.id} className="group/category">
      <div className="mb-2 px-1">
        <p className="text-[9px] text-gray-600 uppercase tracking-[0.2em] font-sans font-bold">
          {t(category.labelKey)}
        </p>
        <p className="mt-1 text-[9px] font-sans leading-relaxed text-gray-500/80">
          {t(categoryDescriptionKey)}
        </p>
        {showWorkflowCues && (
          <p className="mt-1.5 text-[8px] uppercase tracking-[0.18em] text-white/[0.18] opacity-30 transition-all duration-300">
            {t("suggestedFlow")}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        {tools.map((tool, index) => (
          <Fragment key={tool.id}>
            <AiStudioToolCard
              tool={tool}
              index={index}
              isActive={selectedTool?.id === tool.id}
              disabled={hasActiveJobInFlight}
              onSelect={onSelectTool}
            />
            {showWorkflowCues && index < tools.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.06 }}
                className="flex items-center gap-2.5 py-0.5"
                aria-hidden="true"
              >
                <div className="w-7 flex justify-center">
                  <div className="flex flex-col items-center gap-0.5">
                    {/* Vertical line */}
                    <div className="h-2 w-px bg-gradient-to-b from-white/[0.06] to-white/[0.12]" />
                    {/* Directional chevron */}
                      <svg
                       className="w-2.5 h-2.5 text-white/[0.08] transition-colors duration-300"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                    {/* Short line below */}
                    <div className="h-1 w-px bg-gradient-to-b from-white/[0.12] to-transparent" />
                  </div>
                </div>
                {/* Workflow hint label */}
                <span className="text-[6px] uppercase tracking-[0.2em] text-white/[0.12] font-bold opacity-30 transition-opacity duration-300">
                  {index === 0
                    ? t("workflowStart")
                    : t("workflowNext")}
                </span>
              </motion.div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
