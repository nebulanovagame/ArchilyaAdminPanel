import { doc, updateDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";

export type AiStudioJobFeedback = "positive" | "negative" | null;

export async function saveAiJobFeedback(
  uid: string,
  jobId: string,
  feedback: AiStudioJobFeedback,
): Promise<void> {
  const db = getFirebaseFirestore();
  const jobRef = doc(db, "users", uid, "aiStudioJobs", jobId);

  await updateDoc(jobRef, {
    feedback,
    updatedAt: new Date().toISOString(),
  });
}
