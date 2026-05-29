"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SceneReference } from "../types";
import { revokeObjectUrlSafe } from "../utils";

export function useAiStudioFileInput() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sceneReferenceInputRef = useRef<HTMLInputElement | null>(null);
  // Track the current object URL so we can revoke it on unmount or replacement.
  const objectUrlRef = useRef<string | null>(null);

  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreviewState] = useState<string | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState("");
  const [sceneReferences, setSceneReferences] = useState<SceneReference[]>([]);
  const [primaryDropActive, setPrimaryDropActive] = useState(false);

  // Safe setter that revokes the previous object URL before assigning a new one.
  const setRefImagePreview = useCallback((url: string | null) => {
    revokeObjectUrlSafe(objectUrlRef.current);
    objectUrlRef.current = url;
    setRefImagePreviewState(url);
  }, []);

  const clearRefState = useCallback(() => {
    // Use the wrapper so objectUrlRef stays in sync with React state.
    setRefImagePreview(null);
    setRefImageFile(null);
    setSelectedFileUrl("");
    setPrimaryDropActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setRefImagePreview]);

  // Cleanup on unmount to prevent blob URL leaks.
  useEffect(() => {
    return () => {
      revokeObjectUrlSafe(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  const appendSceneReference = useCallback((file: File) => {
    const normalizedType = String(file.type || "").toLowerCase();
    if (
      !normalizedType.startsWith("image/") &&
      normalizedType !== "application/pdf" &&
      !/\.pdf$/i.test(file.name)
    ) {
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      return;
    }
    setSceneReferences((current) => {
      if (current.length >= 4) return current;
      return [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          url: "",
          label: file.name.replace(/\.[^.]+$/, ""),
          note: "",
          type: "object" as const,
        },
      ];
    });
  }, []);

  const removeSceneReference = useCallback((referenceId: string) => {
    setSceneReferences((current) => current.filter((reference) => reference.id !== referenceId));
  }, []);

  const handlePrimaryFileSelection = useCallback(
    (file: File) => {
      if (!file) return;
      const normalizedType = String(file.type || "").toLowerCase();
      const isImage = normalizedType.startsWith("image/");
      const isPdf = normalizedType === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isImage && !isPdf) return;
      if (file.size > 20 * 1024 * 1024) return;

      clearRefState();
      setRefImageFile(file);
      setSelectedFileUrl("");
      if (isPdf) {
        setRefImagePreview(null);
      } else {
        const url = URL.createObjectURL(file);
        setRefImagePreview(url);
      }
    },
    [clearRefState, setRefImagePreview],
  );

  const handlePrimaryDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setPrimaryDropActive(false);
      const file = event.dataTransfer.files?.[0];
      if (file) handlePrimaryFileSelection(file);
    },
    [handlePrimaryFileSelection],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setPrimaryDropActive(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setPrimaryDropActive(false);
  }, []);

  return {
    refImageFile,
    refImagePreview,
    selectedFileUrl,
    sceneReferences,
    primaryDropActive,
    fileInputRef,
    sceneReferenceInputRef,
    clearRefState,
    appendSceneReference,
    removeSceneReference,
    handlePrimaryFileSelection,
    handlePrimaryDrop,
    onDragOver,
    onDragLeave,
    setPrimaryDropActive,
    setSelectedFileUrl,
    setRefImagePreview,
    setRefImageFile,
    setSceneReferences,
  };
}

export type UseAiStudioFileInputReturn = ReturnType<typeof useAiStudioFileInput>;
