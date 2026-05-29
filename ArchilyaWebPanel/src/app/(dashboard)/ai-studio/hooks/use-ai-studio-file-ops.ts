"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { uploadProjectFiles } from "@/lib/projects/service";
import type { ProjectRecord } from "@/lib/projects/types";

import {
  buildDefaultAiFileName,
  ensureFileExtension,
  getMimeAndExtFromImageSource,
  imageSourceToFile,
  isDataUrl,
} from "../utils";
import type { ResultImage, ResultMeta } from "../types";

interface FileOpsDeps {
  currentUser: { uid: string; email: string | null } | null;
  ownerName: string;
  imageSourceMessages: { missingSource: string; downloadFailed: string };
  myProjects: ProjectRecord[];
  refreshProjects: () => void | Promise<void>;
  updatePoolStorage: (bytes: number) => Promise<void>;
  setSaving: (v: boolean) => void;
  setSharing: (v: boolean) => void;
}

export function useAiStudioFileOps(
  resultImage: ResultImage | null,
  resultMeta: ResultMeta | null,
  selectedToolLabel: string | null,
  deps: FileOpsDeps,
) {
  const t = useTranslations();

  const handleDownloadCurrentResult = useCallback(async () => {
    if (!resultImage?.src) return;
    const { mimeType, ext } = getMimeAndExtFromImageSource(resultImage.src, resultImage.mimeType || "image/png");
    const fileName = ensureFileExtension(buildDefaultAiFileName(resultMeta?.toolId || "ai"), ext);
    try {
      if (isDataUrl(resultImage.src)) {
        const anchor = document.createElement("a");
        anchor.href = resultImage.src;
        anchor.download = fileName;
        anchor.click();
      } else {
        const outputFile = await imageSourceToFile(resultImage.src, fileName, resultImage.mimeType || mimeType, deps.imageSourceMessages);
        const objectUrl = URL.createObjectURL(outputFile);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      }
      toast.success(t("dashboard.aiStudio.downloaded", { mimeType }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.aiStudio.downloadFailed"));
    }
  }, [resultImage, resultMeta, deps.imageSourceMessages, t]);

  const handleNativeShare = useCallback(async () => {
    if (!resultImage?.src) return;
    if (!navigator.share) {
      await handleDownloadCurrentResult();
      return;
    }
    deps.setSharing(true);
    try {
      const { ext } = getMimeAndExtFromImageSource(resultImage.src, resultImage.mimeType || "image/png");
      const fileName = ensureFileExtension(buildDefaultAiFileName(resultMeta?.toolId || "ai"), ext);
      const shareFile = await imageSourceToFile(resultImage.src, fileName, resultImage.mimeType || "image/png", deps.imageSourceMessages);
      if (!navigator.canShare?.({ files: [shareFile] })) {
        await handleDownloadCurrentResult();
        return;
      }
      await navigator.share({
        title: `Archilya AI · ${selectedToolLabel || t("dashboard.aiStudio.visualOutput")}`,
        files: [shareFile],
      });
      toast.success(t("dashboard.aiStudio.shareOpened"));
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError") {
        toast.error(t("dashboard.aiStudio.shareFailed"));
      }
    } finally {
      deps.setSharing(false);
    }
  }, [resultImage, resultMeta, deps, selectedToolLabel, handleDownloadCurrentResult, t]);

  const handleSaveResultToProject = useCallback(async () => {
    if (!resultImage?.src) {
      toast.error(t("dashboard.aiStudio.saveMissing"));
      return;
    }
    if (!deps.myProjects.length) {
      toast.error(t("dashboard.aiStudio.createProjectFirst"));
      return;
    }
    const targetProject = deps.myProjects[0] as ProjectRecord;
    deps.setSaving(true);
    try {
      const { ext } = getMimeAndExtFromImageSource(resultImage.src, resultImage.mimeType || "image/png");
      const fileName = ensureFileExtension(buildDefaultAiFileName(resultMeta?.toolId || "ai"), ext);
      const outputFile = await imageSourceToFile(resultImage.src, fileName, resultImage.mimeType || "image/png", deps.imageSourceMessages);
      await uploadProjectFiles(targetProject, [outputFile], deps.currentUser?.uid || "", deps.ownerName);
      await deps.refreshProjects();
      await deps.updatePoolStorage(outputFile.size).catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ai-studio] Pool storage update failed:", error instanceof Error ? error.message : error);
        }
      });
      toast.success(t("dashboard.aiStudio.savedToProject", { projectName: targetProject.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.aiStudio.saveFailed"));
    } finally {
      deps.setSaving(false);
    }
  }, [resultImage, resultMeta, deps, t]);

  return { handleDownloadCurrentResult, handleNativeShare, handleSaveResultToProject };
}
