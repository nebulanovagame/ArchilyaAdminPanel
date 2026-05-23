"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  ImageIcon,
  Trash2,
  Home,
  TreePine,
  Navigation,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { useIntakeContext } from "@/stores/intake-store";
import {
  SCENE_DIRECTIONS,
  type SceneType,
  type SceneDirection,
} from "@/lib/types/scene";

interface SceneCardProps {
  sceneId: string;
  index: number;
}

export default function SceneCard({ sceneId, index }: SceneCardProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const { scenes, updateScene, removeScene } = useIntakeContext();
  const scene = scenes.find((s) => s.id === sceneId);

  if (!scene) return null;

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateScene(sceneId, { label: e.target.value });
  };

  const handleDirectionChange = (direction: SceneDirection) => {
    updateScene(sceneId, { direction });
  };

  const handleTypeChange = (type: SceneType) => {
    updateScene(sceneId, { type });
  };

  const handleFurnishingChange = (hasFurnishing: boolean) => {
    updateScene(sceneId, { hasFurnishing });
  };

  const handleFrameQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateScene(sceneId, { frameQuality: Number(e.target.value) });
  };

  const handleRemove = () => {
    if (scene.imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(scene.imagePreview);
    }
    removeScene(sceneId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="flex gap-4 p-4 bg-[#0d0f13] border border-white/10 rounded-sm hover:border-white/20 transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-24 h-24 flex-shrink-0 rounded-sm border border-white/10 overflow-hidden bg-[#0a0c0f]">
        {scene.imagePreview ? (
          <Image
            src={scene.imagePreview}
            alt={scene.label}
            width={96}
            height={96}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-700" />
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Label + Delete */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={scene.label}
            onChange={handleLabelChange}
            placeholder={t("sceneLabelPlaceholder")}
            className="flex-1 min-w-0 bg-transparent border-b border-white/10 pb-1 text-sm font-sans text-white placeholder:text-gray-600 focus:border-primary focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors"
            title={t("removeScene")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interior / Exterior Toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange("interior")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all ${
              scene.type === "interior"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
            }`}
          >
            <Home className="w-3 h-3" />
            {t("interior")}
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("exterior")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all ${
              scene.type === "exterior"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
            }`}
          >
            <TreePine className="w-3 h-3" />
            {t("exterior")}
          </button>
        </div>

        {/* Mock Visual Audit Controls */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">
              VIS-001 Tefrişat
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFurnishingChange(true)}
                className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all ${
                  scene.hasFurnishing
                    ? "bg-[#2ED573]/15 text-[#2ED573] border border-[#2ED573]/30"
                    : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
                }`}
              >
                Var
              </button>
              <button
                type="button"
                onClick={() => handleFurnishingChange(false)}
                className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all ${
                  !scene.hasFurnishing
                    ? "bg-[#FF4757]/15 text-[#FF4757] border border-[#FF4757]/30"
                    : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
                }`}
              >
                Yok
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-sans uppercase tracking-wider text-gray-500">
                VIS-002 Kadraj
              </span>
              <span className="text-[10px] font-bold text-gray-400">{scene.frameQuality}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={scene.frameQuality}
              onChange={handleFrameQualityChange}
              className="w-full accent-primary"
            />
          </div>
        </div>

        {/* Direction Picker */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Navigation className="w-3 h-3" />
            <span className="text-[10px] font-sans uppercase tracking-wider">{t("direction")}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SCENE_DIRECTIONS.map((dir) => (
              <button
                key={dir.value}
                type="button"
                onClick={() => handleDirectionChange(dir.value)}
                className={`px-2 py-1 rounded-sm text-[10px] font-medium uppercase tracking-wider transition-all ${
                  scene.direction === dir.value
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10 hover:text-gray-300"
                }`}
              >
                {t(dir.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
