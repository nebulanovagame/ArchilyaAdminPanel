"use client";

import { Circle, Eraser, MousePointer2, Pencil, Redo2, Type } from "lucide-react";
import { useTranslations } from "next-intl";

import { useMarkupContext } from "@/stores/markup-store";
import type { MarkupTool } from "@/lib/types/markup";

const tools: { id: MarkupTool; key: string; icon: typeof Pencil }[] = [
  { id: "freehand", key: "markup.freehand", icon: Pencil },
  { id: "circle", key: "markup.circle", icon: Circle },
  { id: "arrow", key: "markup.arrow", icon: MousePointer2 },
  { id: "text", key: "markup.text", icon: Type },
  { id: "eraser", key: "markup.eraser", icon: Eraser },
];

export default function AnnotationToolbar() {
  const t = useTranslations("dashboard.archilyaRender");
  const {
    selectedTool,
    color,
    strokeWidth,
    canUndo,
    canRedo,
    setSelectedTool,
    setColor,
    setStrokeWidth,
    undoAnnotation,
    redoAnnotation,
  } = useMarkupContext();

  return (
    <aside className="flex w-full flex-col gap-3 rounded-sm border border-white/10 bg-[#0d0f13] p-3 lg:w-24">
      <div className="grid grid-cols-5 gap-2 lg:grid-cols-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = selectedTool === tool.id;
          const label = t(tool.key);

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setSelectedTool(tool.id)}
              className={`flex h-11 items-center justify-center rounded-sm border transition-all ${
                isActive
                  ? "border-[#6C63FF]/50 bg-[#6C63FF]/20 text-[#6C63FF]"
                  : "border-white/10 bg-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300"
              }`}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={undoAnnotation}
        disabled={!canUndo}
        className="flex h-11 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-gray-500 transition-all hover:border-white/20 hover:text-gray-300 disabled:cursor-not-allowed disabled:text-gray-700"
        title={t("markup.undo")}
      >
        <Redo2 className="h-4 w-4 rotate-180" />
      </button>

      <button
        type="button"
        onClick={redoAnnotation}
        disabled={!canRedo}
        className="flex h-11 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-gray-500 transition-all hover:border-white/20 hover:text-gray-300 disabled:cursor-not-allowed disabled:text-gray-700"
        title={t("markup.redo")}
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <label className="space-y-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {t("markup.color")}
        <input
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="h-10 w-full cursor-pointer rounded-sm border border-white/10 bg-transparent"
        />
      </label>

      <label className="space-y-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {t("markup.thickness")}
        <input
          type="range"
          min="1"
          max="16"
          value={strokeWidth}
          onChange={(event) => setStrokeWidth(Number(event.target.value))}
          className="w-full accent-[#6C63FF]"
        />
        <span className="block text-center text-xs text-gray-400">{strokeWidth}</span>
      </label>
    </aside>
  );
}
