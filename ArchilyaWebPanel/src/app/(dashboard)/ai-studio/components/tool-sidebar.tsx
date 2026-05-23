"use client";

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { TOOLS, COMING_SOON } from "../constants";

type ToolItem = (typeof TOOLS)[number];

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

interface ToolSidebarProps {
  selectedTool: ToolItem | null;
  onSelectTool: (tool: ToolItem) => void;
  hasActiveJobInFlight: boolean;
}

export default function ToolSidebar({ selectedTool, onSelectTool, hasActiveJobInFlight }: ToolSidebarProps) {
  const t = useTranslations("dashboard.aiStudio");
  const commonT = useTranslations("common");
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  return (
    <div className="space-y-4 xl:sticky xl:top-20 self-start">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-sans">{t("selectTool")}</p>
      <div className="space-y-2">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const isActive = selectedTool?.id === tool.id;
          return (
            <motion.button
              key={tool.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              disabled={hasActiveJobInFlight}
              onClick={() => onSelectTool(tool)}
              className={`w-full text-left flex items-center gap-3 p-3.5 rounded-sm border transition-all ${isActive ? `${tool.bg} ${tool.border} border` : "bg-[#0d0f13] border-white/5 hover:border-white/15"} ${hasActiveJobInFlight ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${tool.bg} border ${tool.border}`}>
                <Icon className={`w-4 h-4 ${tool.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xs font-sans font-bold uppercase tracking-wider ${isActive ? "text-white" : "text-gray-300"}`}>{t(`tools.${tool.id}.label`)}</p>
                  {tool.badge && <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${tool.bg} ${tool.border} ${tool.color}`}>{tool.badge}</span>}
                </div>
                <p className="text-[10px] text-gray-600 font-sans mt-0.5">{isHydrated ? tool.credit : "—"} {commonT("credit")}</p>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? tool.color : "text-gray-700"}`} />
            </motion.button>
          );
        })}
      </div>

      <div>
        <p className="text-[10px] text-gray-700 uppercase tracking-widest font-sans mb-2 mt-2">{t("comingSoon")}</p>
        <div className="space-y-2">
          {COMING_SOON.map((tool) => {
            const Icon = tool.icon;
            return (
              <div key={tool.id} className="w-full flex items-center gap-3 p-3.5 rounded-sm border border-white/3 bg-white/1 opacity-40 cursor-not-allowed">
                <div className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${tool.color.replace("text-", "bg-")}/10 border ${tool.color.replace("text-", "border-")}/20`}>
                  <Icon className={`w-4 h-4 ${tool.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-sans font-bold uppercase tracking-wider text-gray-500">{t(`comingTools.${tool.id}`)}</p>
                </div>
                <Clock className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedTool && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`p-4 rounded-sm border ${selectedTool.bg} ${selectedTool.border}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${selectedTool.color}`}>{t(`tools.${selectedTool.id}.label`)}</p>
            <p className="text-xs text-gray-400 font-sans leading-relaxed">{t(`tools.${selectedTool.id}.desc`)}</p>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
              <Sparkles className={`w-3 h-3 ${selectedTool.color}`} />
              <p className={`text-[11px] font-bold ${selectedTool.color}`}>{selectedTool.credit} {commonT("credit")} · Archilya AI</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
