"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  ImageIcon,
  Layers,
} from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useImagePreview } from "@/hooks/use-image-preview";
import { useIntakeContext } from "@/stores/intake-store";
import {
  MATERIAL_CATEGORIES,
  VALID_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_MATERIALS,
  type MaterialCategory,
} from "@/lib/types/scene";

export default function MaterialPalette() {
  const t = useTranslations("dashboard.archilyaRender");
  const { materials, addMaterial, updateMaterial, removeMaterial } = useIntakeContext();
  const { createPreview, revokePreview } = useImagePreview();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isMaxReached = materials.length >= MAX_MATERIALS;

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

      const remainingSlots = MAX_MATERIALS - materials.length;
      if (remainingSlots <= 0) {
        toast.error(t("errors.maxMaterialsReached", { max: MAX_MATERIALS }));
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      let successCount = 0;

      for (const file of filesToProcess) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
          continue;
        }

        addMaterial({
          label: file.name.replace(/\.[^.]+$/, ""),
          category: "floor",
          imageFile: file,
          imagePreview: await createPreview(file),
          order: materials.length + successCount,
        });
        successCount++;
      }

      if (successCount > 0) {
        toast.success(t("materialsAdded", { count: successCount }));
      }
    },
    [materials.length, addMaterial, createPreview, t, validateFile],
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
      processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles],
  );

  const handleRemove = useCallback(
    (id: string, preview: string | null) => {
      if (preview) revokePreview(preview);
      removeMaterial(id);
    },
    [removeMaterial, revokePreview],
  );

  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      updateMaterial(id, { label });
    },
    [updateMaterial],
  );

  const handleCategoryChange = useCallback(
    (id: string, category: MaterialCategory) => {
      updateMaterial(id, { category });
    },
    [updateMaterial],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-sans font-medium uppercase tracking-widest text-gray-400">
            {t("materialsTitle")}
          </span>
        </div>
        <span className="text-[10px] font-sans text-gray-600">
          {materials.length} / {MAX_MATERIALS}
        </span>
      </div>

      {/* Add Button / Drop Zone */}
      {!isMaxReached && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border border-dashed rounded-sm p-4 text-center cursor-pointer
            transition-all duration-300 group
            ${
              isDragging
                ? "border-primary bg-primary/5"
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
          />

          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-8 h-8 rounded-sm flex items-center justify-center transition-colors ${
                isDragging ? "bg-primary/20" : "bg-white/5 group-hover:bg-primary/10"
              }`}
            >
              <Plus
                className={`w-4 h-4 transition-colors ${
                  isDragging ? "text-primary" : "text-gray-500 group-hover:text-primary"
                }`}
              />
            </div>
            <span className="text-xs font-sans text-gray-500 group-hover:text-gray-300 transition-colors">
              {t("addMaterials")}
            </span>
          </div>

          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 rounded-sm flex items-center justify-center">
              <p className="text-primary font-sans text-xs">{t("dropHere")}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Materials Grid */}
      <AnimatePresence mode="popLayout">
        {materials.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          >
            {materials.map((material, index) => (
              <motion.div
                key={material.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="group relative bg-[#0d0f13] border border-white/10 rounded-sm overflow-hidden hover:border-white/20 transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative overflow-hidden">
                  {material.imagePreview ? (
                    <Image
                      src={material.imagePreview}
                      alt={material.label}
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

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(material.id, material.imagePreview)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/80 border border-white/10 rounded-sm flex items-center justify-center text-gray-400 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-2 space-y-2">
                  <input
                    type="text"
                    value={material.label}
                    onChange={(e) => handleLabelChange(material.id, e.target.value)}
                    placeholder={t("materialLabelPlaceholder")}
                    className="w-full bg-transparent text-xs font-sans text-white placeholder:text-gray-600 border-b border-white/10 pb-1 focus:border-primary focus:outline-none transition-colors"
                  />

                  <select
                    value={material.category}
                    onChange={(e) =>
                      handleCategoryChange(material.id, e.target.value as MaterialCategory)
                    }
                    className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-2 py-1 text-[10px] font-sans text-gray-400 uppercase tracking-wider focus:border-primary focus:outline-none transition-colors"
                  >
                    {MATERIAL_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {t(cat.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
