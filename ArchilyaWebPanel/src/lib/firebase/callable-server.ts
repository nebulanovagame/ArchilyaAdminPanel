import { verifyFirebaseIdToken, type SessionUser } from "@/lib/auth/session";
import { BackendCallableError } from "@/lib/api/errors";

function getCallableBaseUrl() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "europe-west1";

  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID eksik.");
  }

  return `https://${region}-${projectId}.cloudfunctions.net`;
}

export async function requireVerifiedFirebaseIdentity(
  sessionUser: SessionUser | null,
  idToken: string,
) {
  if (!sessionUser) {
    throw new Error("Oturum bulunamadı.");
  }

  if (!idToken) {
    throw new Error("Firebase kimlik bilgisi eksik.");
  }

  const firebaseUser = await verifyFirebaseIdToken(idToken);
  if (firebaseUser.uid !== sessionUser.uid) {
    throw new Error("Session ve Firebase kullanıcıları eşleşmiyor.");
  }

  return firebaseUser;
}

export async function callFirebaseCallableFromServer<TPayload, TResult>(
  callableName: string,
  idToken: string,
  payload: TPayload,
) {
  const response = await fetch(`${getCallableBaseUrl()}/${callableName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: payload }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { result?: TResult; error?: { message?: string; status?: string; code?: string } }
    | null;

  if (!response.ok || data?.error) {
    throw new BackendCallableError(
      callableName,
      data?.error?.message || `Firebase callable başarısız oldu: ${callableName}`,
      data?.error?.status ?? data?.error?.code,
    );
  }

  return data?.result as TResult;
}
