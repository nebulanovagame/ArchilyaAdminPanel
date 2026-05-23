"use client";

import { useCallback } from "react";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Image preview could not be created."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Image preview could not be created."));
    };

    reader.onabort = () => {
      reject(new Error("Image preview creation was aborted."));
    };

    reader.readAsDataURL(file);
  });
}

export function useImagePreview() {
  const createPreview = useCallback(
    (file: File): Promise<string> => readFileAsDataUrl(file),
    [],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const revokePreview = useCallback((_url: string): void => {
    // Data URLs are plain strings and do not need browser resource cleanup.
  }, []);

  return { createPreview, revokePreview };
}
