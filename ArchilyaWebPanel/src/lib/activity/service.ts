import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { mapActivityLogDocument, safeParseActivityTimestamp } from "./mapper";
import type { ActivityLogQueryOptions, ActivityLogRecord } from "./types";

const ACTIVITY_COLLECTION = "workspaceActivityLogs";
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_RECENT_LIMIT = 5;

function isQueryDocumentSnapshot(value: unknown): value is QueryDocumentSnapshot<DocumentData> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    data?: unknown;
    get?: unknown;
    id?: unknown;
    ref?: unknown;
  };

  return typeof candidate.data === "function"
    && typeof candidate.get === "function"
    && typeof candidate.id === "string"
    && Boolean(candidate.ref);
}

function getActivityCollection(db: Firestore) {
  return collection(db, ACTIVITY_COLLECTION);
}

function toQueryTimestamp(value: ActivityLogQueryOptions["fromDate"] | ActivityLogQueryOptions["toDate"]) {
  return safeParseActivityTimestamp(value);
}

export async function createActivityLogEntry(
  db: Firestore,
  entry: Omit<ActivityLogRecord, "id">,
): Promise<string> {
  const { timestamp: _timestamp, ...rest } = entry;
  const docRef = await addDoc(getActivityCollection(db), {
    ...rest,
    timestamp: serverTimestamp(),
  });

  return docRef.id;
}

export async function getActivityLogsForWorkspace(
  db: Firestore,
  options: ActivityLogQueryOptions,
): Promise<{ logs: ActivityLogRecord[]; hasMore: boolean; nextCursor?: unknown }> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const constraints: QueryConstraint[] = [where("workspaceId", "==", options.workspaceId)];

  if (options.category) {
    constraints.push(where("category", "==", options.category));
  }

  if (options.action) {
    constraints.push(where("action", "==", options.action));
  }

  if (options.actorUid) {
    constraints.push(where("actorUid", "==", options.actorUid));
  }

  const fromTimestamp = toQueryTimestamp(options.fromDate);
  if (fromTimestamp) {
    constraints.push(where("timestamp", ">=", fromTimestamp));
  }

  const toTimestamp = toQueryTimestamp(options.toDate);
  if (toTimestamp) {
    constraints.push(where("timestamp", "<=", toTimestamp));
  }

  constraints.push(orderBy("timestamp", "desc"), limit(pageSize));

  if (isQueryDocumentSnapshot(options.cursor)) {
    constraints.push(startAfter(options.cursor));
  }

  const snapshot = await getDocs(query(getActivityCollection(db), ...constraints));
  const logs = snapshot.docs.map((docSnap) => mapActivityLogDocument(docSnap.id, docSnap.data()));
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined;

  return {
    logs,
    hasMore: snapshot.docs.length === pageSize,
    nextCursor,
  };
}

export async function getRecentActivityLogs(
  db: Firestore,
  workspaceId: string,
  maxCount = DEFAULT_RECENT_LIMIT,
): Promise<ActivityLogRecord[]> {
  const snapshot = await getDocs(query(
    getActivityCollection(db),
    where("workspaceId", "==", workspaceId),
    orderBy("timestamp", "desc"),
    limit(maxCount),
  ));

  return snapshot.docs.map((docSnap) => mapActivityLogDocument(docSnap.id, docSnap.data()));
}
