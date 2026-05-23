"use client";

import { useState } from "react";

import { uploadProjectFiles } from "@/lib/projects/service";
import type { ProjectRecord } from "@/lib/projects/types";

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  async function uploadFiles(project: ProjectRecord, files: File[], ownerUid: string, ownerName: string) {
    setUploading(true);

    try {
      await uploadProjectFiles(project, files, ownerUid, ownerName, (fileName, nextProgress) => {
        setProgress((current) => ({ ...current, [fileName]: nextProgress }));
      });
    } finally {
      setUploading(false);
      setProgress({});
    }
  }

  return {
    uploading,
    progress,
    uploadFiles,
  };
}
