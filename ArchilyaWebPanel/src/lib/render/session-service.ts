import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

import type { RenderSession, RenderSessionInput, RenderSessionStatus } from "@/lib/types/render-session";

const COLLECTION_NAME = "renderSessions";

function getCollection() {
  return collection(getFirestore(), COLLECTION_NAME);
}

function getDocRef(sessionId: string) {
  return doc(getFirestore(), COLLECTION_NAME, sessionId);
}

function normalizeTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function mapRenderSessionDocument(id: string, data: Record<string, unknown>): RenderSession {
  return {
    id,
    uid: String(data.uid || ""),
    workspaceId: String(data.workspaceId || ""),
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    status: normalizeRenderSessionStatus(data.status),
    scenes: Array.isArray(data.scenes) ? data.scenes.map(normalizeSceneMetadata) : [],
    materials: Array.isArray(data.materials) ? data.materials.map(normalizeMaterialMetadata) : [],
    lightPreference: typeof data.lightPreference === "string" ? data.lightPreference : null,
    annotations: Array.isArray(data.annotations) ? data.annotations : [],
    constraints: Array.isArray(data.constraints) ? data.constraints : [],
    metricLocks: typeof data.metricLocks === "object" && data.metricLocks !== null
      ? data.metricLocks as Record<string, { aspectRatio: number; estimatedDepth: number; volumeScore: number; isLocked: boolean }>
      : {},
    consistencyScore: typeof data.consistencyScore === "number" ? data.consistencyScore : null,
    jobId: typeof data.jobId === "string" ? data.jobId : undefined,
    outputImageUrls: Array.isArray(data.outputImageUrls) ? data.outputImageUrls.filter((url): url is string => typeof url === "string") : undefined,
    createdAt: normalizeTimestamp(data.createdAt) || new Date(),
    updatedAt: normalizeTimestamp(data.updatedAt) || new Date(),
  };
}

function normalizeRenderSessionStatus(value: unknown): RenderSessionStatus {
  const status = String(value || "").toLowerCase();
  switch (status) {
    case "audited": return "audited";
    case "markup-done": return "markup-done";
    case "spatial-locked": return "spatial-locked";
    case "rendering": return "rendering";
    case "completed": return "completed";
    case "failed": return "failed";
    default: return "draft";
  }
}

function normalizeSceneMetadata(value: unknown): RenderSession["scenes"][number] {
  if (!value || typeof value !== "object") return { id: "", label: "", direction: "", type: "", hasFurnishing: false, frameQuality: 0, order: 0 };
  const data = value as Record<string, unknown>;
  return {
    id: String(data.id || ""),
    label: String(data.label || ""),
    direction: String(data.direction || ""),
    type: String(data.type || ""),
    hasFurnishing: typeof data.hasFurnishing === "boolean" ? data.hasFurnishing : false,
    frameQuality: typeof data.frameQuality === "number" ? data.frameQuality : 0,
    order: typeof data.order === "number" ? data.order : 0,
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
  };
}

function normalizeMaterialMetadata(value: unknown): RenderSession["materials"][number] {
  if (!value || typeof value !== "object") return { id: "", label: "", category: "" };
  const data = value as Record<string, unknown>;
  return {
    id: String(data.id || ""),
    label: String(data.label || ""),
    category: String(data.category || ""),
    imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
  };
}

export async function createRenderSession(input: RenderSessionInput): Promise<{ id: string }> {
  const docRef = await addDoc(getCollection(), {
    ...input,
    status: input.status || "draft",
    scenes: input.scenes || [],
    materials: input.materials || [],
    lightPreference: input.lightPreference ?? null,
    annotations: input.annotations || [],
    constraints: input.constraints || [],
    metricLocks: input.metricLocks || {},
    consistencyScore: input.consistencyScore ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: docRef.id };
}

export async function updateRenderSession(
  sessionId: string,
  updates: Partial<Omit<RenderSessionInput, "uid" | "workspaceId">>,
): Promise<void> {
  await updateDoc(getDocRef(sessionId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function getRenderSession(sessionId: string): Promise<RenderSession | null> {
  const snapshot = await getDoc(getDocRef(sessionId));
  if (!snapshot.exists()) return null;
  return mapRenderSessionDocument(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export function watchRenderSession(
  sessionId: string,
  onData: (session: RenderSession | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    getDocRef(sessionId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(mapRenderSessionDocument(snapshot.id, snapshot.data() as Record<string, unknown>));
    },
    (error) => {
      if (onError) onError(error);
    },
  );
}

export function watchUserRenderSessions(
  uid: string,
  onData: (sessions: RenderSession[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    getCollection(),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions = snapshot.docs.map((docSnap) =>
        mapRenderSessionDocument(docSnap.id, docSnap.data() as Record<string, unknown>),
      );
      onData(sessions);
    },
    (error) => {
      if (onError) onError(error);
    },
  );
}
