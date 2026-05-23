"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import { ImageIcon, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useImagePreview } from "@/hooks/use-image-preview";
import { MAX_CLIENT_REFERENCES, MAX_MOODBOARDS, MAX_FILE_SIZE_BYTES, VALID_IMAGE_TYPES } from "@/lib/types/scene";
import { useIntakeContext } from "@/stores/intake-store";

export default function MoodboardUploader() {
  const t = useTranslations("dashboard.archilyaRender");
  const { moodboards, clientReferences, addMoodboard, removeMoodboard, addClientReference, removeClientReference } = useIntakeContext();
  const { createPreview, revokePreview } = useImagePreview();
  const moodboardInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File) => {
      if (!VALID_IMAGE_TYPES.includes(file.type as typeof VALID_IMAGE_TYPES[number])) {
        return t("errors.invalidFormat", { name: file.name });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return t("errors.fileTooLarge", { name: file.name, max: "20" });
      }
      return "";
    },
    [t],
  );

  const processMoodboards = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      for (const file of Array.from(files).slice(0, MAX_MOODBOARDS - moodboards.length)) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
          continue;
        }

        addMoodboard({
          label: file.name.replace(/\.[^.]+$/, ""),
          imageFile: file,
          imagePreview: await createPreview(file),
        });
      }
    },
    [addMoodboard, createPreview, moodboards.length, validateFile],
  );

  const processReferences = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      for (const file of Array.from(files).slice(0, MAX_CLIENT_REFERENCES - clientReferences.length)) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
          continue;
        }

        addClientReference({
          label: file.name.replace(/\.[^.]+$/, ""),
          imageFile: file,
          imagePreview: await createPreview(file),
        });
      }
    },
    [addClientReference, clientReferences.length, createPreview, validateFile],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <UploadColumn
        title={t("moodboardsTitle")}
        count={moodboards.length}
        max={MAX_MOODBOARDS}
        inputRef={moodboardInputRef}
        onFiles={processMoodboards}
      />
      <UploadColumn
        title={t("clientReferencesTitle")}
        count={clientReferences.length}
        max={MAX_CLIENT_REFERENCES}
        inputRef={referenceInputRef}
        onFiles={processReferences}
      />

        <PreviewGrid
        items={moodboards}
        onRemove={(id, preview) => {
          if (preview) revokePreview(preview);
          removeMoodboard(id);
        }}
      />
      <PreviewGrid
        items={clientReferences}
        onRemove={(id, preview) => {
          if (preview) revokePreview(preview);
          removeClientReference(id);
        }}
      />
    </div>
  );
}

function UploadColumn({
  title,
  count,
  max,
  inputRef,
  onFiles,
}: {
  title: string;
  count: number;
  max: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
}) {
  const disabled = count >= max;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      className={`rounded-sm border border-dashed p-4 text-left transition-all ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-gray-700"
          : "border-white/10 bg-[#0d0f13] text-gray-400 hover:border-primary/30 hover:text-gray-200"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/5">
          <Plus className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest">{title}</p>
          <p className="mt-1 text-[10px] text-gray-600">{count} / {max}</p>
        </div>
      </div>
    </button>
  );
}

function PreviewGrid({
  items,
  onRemove,
}: {
  items: Array<{ id: string; label: string; imagePreview: string | null }>;
  onRemove: (id: string, preview: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="group relative overflow-hidden rounded-sm border border-white/10 bg-[#0d0f13]">
          {item.imagePreview ? (
            <Image src={item.imagePreview} alt={item.label} width={320} height={112} unoptimized className="h-28 w-full object-cover" />
          ) : (
            <div className="flex h-28 items-center justify-center"><ImageIcon className="h-6 w-6 text-gray-700" /></div>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id, item.imagePreview)}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm border border-white/10 bg-black/80 text-gray-400 opacity-0 transition-all hover:text-[#FF4757] group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="truncate p-2 text-xs text-gray-400">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
