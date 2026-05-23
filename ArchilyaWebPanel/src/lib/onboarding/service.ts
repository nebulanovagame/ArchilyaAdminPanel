import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";

export async function checkHasSeenOnboarding(uid: string): Promise<boolean> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) return false;

  const data = snap.data();
  return data.hasSeenOnboarding === true;
}

export async function markOnboardingSeen(uid: string): Promise<void> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, {
    hasSeenOnboarding: true,
    onboardingSeenAt: new Date().toISOString(),
  });
}
