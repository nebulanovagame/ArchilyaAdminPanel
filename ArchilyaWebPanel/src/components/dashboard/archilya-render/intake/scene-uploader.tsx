"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Upload, X, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useImagePreview } from "@/hooks/use-image-preview";
import { useIntakeContext } from "@/stores/intake-store";
import {
  getSceneDirectionLabelKey,
  VALID_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_SCENES,
} from "@/lib/types/scene";

export default function SceneUploader() {
  const t = useTranslations("dashboard.archilyaRender");
  const { scenes, addScene, removeScene, reorderScenes } = useIntakeContext();
  const { createPreview, revokePreview } = useImagePreview();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const readFilePreview = useCallback(
    async (file: File, order: number) => {
      addScene({
        label: file.name.replace(/\.[^.]+$/, ""),
        direction: "north",
        type: "interior",
        imageFile: file,
        imagePreview: await createPreview(file),
        thumbnailUrl: null,
        hasFurnishing: true,
        frameQuality: 85,
        order,
      });
    },
    [addScene, createPreview],
  );

  const validateFile = useCallback((file: File): string | null => {
    if (!VALID_IMAGE_TYPES.includes(file.type as typeof VALID_IMAGE_TYPES[number])) {
      return t("errors.invalidFormat", { name: file.name });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return t("errors.fileTooLarge", { name: file.name, max: "20" });
    }
    return null;
  }, [t]);

  const processFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const remainingSlots = MAX_SCENES - scenes.length;
      if (remainingSlots <= 0) {
        toast.error(t("errors.maxScenesReached", { max: MAX_SCENES }));
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      let successCount = 0;

      for (const [index, file] of filesToProcess.entries()) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
          continue;
        }

        await readFilePreview(file, scenes.length + index);
        successCount++;
      }

      if (successCount > 0) {
        toast.success(t("uploadSuccess", { count: successCount }));
      }
    },
    [scenes.length, readFilePreview, t, validateFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      void processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void processFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles],
  );

  const handleRemove = useCallback(
    (id: string, preview: string | null) => {
      if (preview) revokePreview(preview);
      removeScene(id);
    },
    [removeScene, revokePreview],
  );

  const isMaxReached = scenes.length >= MAX_SCENES;

  const handleSceneDrop = useCallback(
    (targetSceneId: string) => {
      if (!draggedSceneId || draggedSceneId === targetSceneId) return;

      const orderedIds = scenes.map((scene) => scene.id);
      const fromIndex = orderedIds.indexOf(draggedSceneId);
      const toIndex = orderedIds.indexOf(targetSceneId);
      if (fromIndex < 0 || toIndex < 0) return;

      const nextIds = [...orderedIds];
      const [movedId] = nextIds.splice(fromIndex, 1);
      nextIds.splice(toIndex, 0, movedId);
      reorderScenes(nextIds);
      setDraggedSceneId(null);
    },
    [draggedSceneId, reorderScenes, scenes],
  );

  const handleSceneDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, sceneId: string) => {
    setDraggedSceneId(sceneId);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const handleSceneDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleSceneDragDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, sceneId: string) => {
      event.preventDefault();
      handleSceneDrop(sceneId);
    },
    [handleSceneDrop],
  );

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <motion.div
        role="button"
        tabIndex={isMaxReached ? -1 : 0}
        aria-label={t("dropzoneTitle")}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={shouldReduceMotion ? false : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isMaxReached && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (!isMaxReached && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`
          relative border-2 border-dashed rounded-sm p-8 text-center cursor-pointer
          transition-all duration-300 group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : isMaxReached
                ? "border-white/5 bg-white/[0.02] cursor-not-allowed opacity-50"
                : "border-white/10 hover:border-primary/30 hover:bg-white/[0.02]"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isMaxReached}
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={`
              w-12 h-12 rounded-sm flex items-center justify-center
              transition-colors duration-300
              ${
                isDragging
                  ? "bg-primary/20"
                  : "bg-white/5 group-hover:bg-primary/10"
              }
            `}
          >
            <Upload
              className={`w-5 h-5 transition-colors ${
                isDragging ? "text-primary" : "text-gray-500 group-hover:text-primary"
              }`}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-sans text-gray-400">
              {isMaxReached
                ? t("maxScenesReached", { max: MAX_SCENES })
                : t("dropzoneTitle")}
            </p>
            <p className="text-xs font-sans text-gray-600">
              {t("dropzoneSubtitle", { formats: "JPG, PNG, WEBP", maxSize: "20MB" })}
            </p>
          </div>

          {!isMaxReached && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-primary hover:text-black transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {t("browseFiles")}
            </button>
          )}
        </div>

        {isDragging && (
          <div className="absolute inset-0 bg-primary/5 rounded-sm flex items-center justify-center">
            <p className="text-primary font-sans text-sm font-medium">{t("dropHere")}</p>
          </div>
        )}
      </motion.div>

      {/* Scene Grid */}
      <AnimatePresence mode="popLayout">
        {scenes.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={shouldReduceMotion ? false : { opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          >
            {scenes.map((scene, index) => (
              <motion.div
                key={scene.id}
                data-testid={`scene-card-${scene.id}`}
                draggable
                layout
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                animate={shouldReduceMotion ? false : { opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, delay: index * 0.05 }}
                onDragStartCapture={(event) => handleSceneDragStart(event, scene.id)}
                onDragOverCapture={handleSceneDragOver}
                onDropCapture={(event) => handleSceneDragDrop(event, scene.id)}
                onDragEnd={() => setDraggedSceneId(null)}
                className={`group relative aspect-square cursor-grab overflow-hidden rounded-sm border bg-[#0d0f13] transition-colors active:cursor-grabbing ${
                  draggedSceneId === scene.id ? "border-primary/50 opacity-60" : "border-white/10"
                }`}
              >
                {scene.imagePreview ? (
                  <Image
                    src={scene.imagePreview}
                    alt={scene.label}
                    fill
                    unoptimized
                    sizes="160px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-700" />
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-white text-xs font-sans truncate mb-1">{scene.label}</p>
                  <p className="text-gray-400 text-[10px] font-sans uppercase tracking-wider">
                    {scene.type === "interior" ? t("interior") : t("exterior")} · {t(getSceneDirectionLabelKey(scene.direction))}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  aria-label="Sil"
                  onClick={() => handleRemove(scene.id, scene.imagePreview)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/80 border border-white/10 rounded-sm flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-all opacity-0 group-hover:opacity-100 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none focus-visible:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Order Badge */}
                <div className="absolute top-2 left-2 w-5 h-5 bg-primary/20 border border-primary/30 rounded-sm flex items-center justify-center">
                  <span className="text-primary text-[10px] font-bold">{index + 1}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scene Counter */}
      {scenes.length > 0 && (
        <div className="flex items-center gap-2 text-xs font-sans text-gray-500" aria-live="polite" aria-atomic="true">
          <ImageIcon className="w-3 h-3" aria-hidden="true" />
          <span>{scenes.length} / {MAX_SCENES} {t("scenesUploaded")}</span>
        </div>
      )}
    </div>
  );
}
