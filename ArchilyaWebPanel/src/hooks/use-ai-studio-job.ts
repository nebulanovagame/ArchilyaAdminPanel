"use client";

import { useCallback, useMemo } from "react";
import { doc, type DocumentSnapshot } from "firebase/firestore";

import { useFirestoreDoc } from "@/hooks/use-firestore-doc";
import { AI_STUDIO_JOB_SUBCOLLECTION, INITIAL_AI_STUDIO_JOB, mapAiStudioJobSnapshot } from "@/lib/ai-studio/job-contract";
import { getFirebaseFirestore } from "@/lib/firebase/client";

export function useAiStudioJob(uid: string | null, jobId: string | null) {
  const jobRef = useMemo(
    () => (uid && jobId ? doc(getFirebaseFirestore(), "users", uid, AI_STUDIO_JOB_SUBCOLLECTION, jobId) : null),
    [jobId, uid],
  );

  const mapSnapshot = useCallback((snapshot: DocumentSnapshot) => {
    return mapAiStudioJobSnapshot(snapshot, jobId || "");
  }, [jobId]);

  return useFirestoreDoc({
    ref: jobRef,
    initialData: INITIAL_AI_STUDIO_JOB,
    mapSnapshot,
    retryOnPermissionDenied: false,
  });
}
