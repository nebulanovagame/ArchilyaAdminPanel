import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  orderBy,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
  type WithFieldValue,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import { getFirebaseFirestore, getFirebaseStorage } from "@/lib/firebase/client";

import { projectConverter } from "./mapper";
import {
  formatDateValue,
  getDefaultFileCount,
  getFileStableId,
  getFileTypeKey,
  mapDeletedFiles,
  shouldRetainTrashItem,
} from "./model";
import type { CreateProjectInput, ProjectFileRecord, ProjectRecord, TrashData } from "./types";

type ProjectCreateDocument = WithFieldValue<ProjectRecord> & Record<string, unknown>;

function projectsCollection() {
  return collection(getFirebaseFirestore(), "projects").withConverter(projectConverter);
}

function projectDoc(projectId: string) {
  return doc(getFirebaseFirestore(), "projects", projectId).withConverter(projectConverter);
}

function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") {
    return "file";
  }

  // 1. Normalize unicode (NFKD decomposes combined chars)
  let sanitized = name.normalize("NFKD");

  // 2. Remove control chars, zero-width chars, and invisible formatting
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u2060\ufeff]/g, "");

  // 3. Replace path separators and dangerous chars with underscore
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, "_");

  // 4. Replace whitespace sequences with single dash
  sanitized = sanitized.replace(/\s+/g, "-");

  // 5. Collapse consecutive dots to single dot (prevents "...." tricks)
  sanitized = sanitized.replace(/\.{2,}/g, ".");

  // 6. Remove leading dots/dashes (prevents hidden files, traversal)
  sanitized = sanitized.replace(/^[.-]+/, "");

  // 7. Only allow safe ASCII chars in final output
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");

  // 8. Remove trailing dots/spaces
  sanitized = sanitized.replace(/[.\s]+$/, "");

  // 9. Ensure we have something left; fallback to 'file'
  if (!sanitized) {
    return "file";
  }

  // 10. Prevent reserved Windows filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reserved.test(sanitized)) {
    sanitized = "_" + sanitized;
  }

  return sanitized;
}

export async function addProjectActivityLog(
  projectId: string,
  entry: { action: string; user: string; details: string },
) {
  const db = getFirebaseFirestore();
  const logsRef = collection(db, "projects", projectId, "activityLogs");
  await addDoc(logsRef, {
    ...entry,
    timestamp: serverTimestamp(),
  });
}

function cleanDeletedFile(file: ProjectFileRecord): ProjectFileRecord {
  const cleanFile: ProjectFileRecord = { ...file };
  delete cleanFile.deletedAt;
  delete cleanFile.projectId;
  delete cleanFile.projectName;
  return cleanFile;
}

function groupTrashFileItems(items: Array<{ projectId: string; file: ProjectFileRecord }>) {
  const grouped = new Map<string, ProjectFileRecord[]>();

  for (const item of items) {
    const current = grouped.get(item.projectId) || [];
    const fileId = getFileStableId(item.file);

    if (!current.some((file) => getFileStableId(file) === fileId)) {
      current.push(item.file);
    }

    grouped.set(item.projectId, current);
  }

  return grouped;
}

export function watchActiveProjects(
  uid: string,
  onData: (projects: ProjectRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    projectsCollection(),
    where("memberUids", "array-contains", uid),
    where("isDeleted", "==", false),
    orderBy("updatedAt", "desc"),
    limit(100),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const projects = snapshot.docs.map((docSnap) => docSnap.data());

      onData(projects);
    },
    (error) => onError(error),
  );
}

export async function fetchActiveProjects(uid: string) {
  const q = query(
    projectsCollection(),
    where("memberUids", "array-contains", uid),
    where("isDeleted", "==", false),
    orderBy("updatedAt", "desc"),
    limit(100),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => docSnap.data());
}

export async function createProject(
  uid: string,
  ownerEmail: string | null,
  ownerName: string,
  input: CreateProjectInput,
) {
  const createdAt = new Date();
  const newProject: ProjectCreateDocument = {
    id: "",
    uid,
    memberUids: [uid],
    name: input.name.trim(),
    location: input.location?.trim() || "",
    status: input.status,
    fileCount: getDefaultFileCount(),
    totalSize: 0,
    files: [],
    deletedFiles: [],
    // activityLog moved to subcollection — see addProjectActivityLog
    team: [
      {
        uid,
        email: ownerEmail,
        role: "owner",
      },
    ],
    invites: [],
    isDeleted: false,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(projectsCollection(), newProject);

  await addProjectActivityLog(docRef.id, {
    action: "create",
    user: ownerName || ownerEmail || "Kullanıcı",
    details: "Proje oluşturuldu.",
  });

  return {
    id: docRef.id,
    uid,
    memberUids: [uid],
    name: input.name.trim(),
    location: input.location?.trim() || "",
    status: input.status,
    fileCount: getDefaultFileCount(),
    totalSize: 0,
    files: [],
    deletedFiles: [],
    isDeleted: false,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  } satisfies ProjectRecord;
}

export async function softDeleteProject(projectId: string) {
  await updateDoc(projectDoc(projectId), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function batchSoftDeleteProjects(projectIds: string[]) {
  if (!projectIds.length) return;

  const db = getFirebaseFirestore();
  const batch = writeBatch(db);

  for (const projectId of projectIds) {
    batch.update(projectDoc(projectId), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function restoreProject(projectId: string) {
  await updateDoc(projectDoc(projectId), {
    isDeleted: false,
    deletedAt: null,
    updatedAt: serverTimestamp(),
  });
}

export async function batchRestoreProjects(projectIds: string[]) {
  if (!projectIds.length) return;

  const db = getFirebaseFirestore();
  const batch = writeBatch(db);

  for (const projectId of projectIds) {
    batch.update(projectDoc(projectId), {
      isDeleted: false,
      deletedAt: null,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function uploadProjectFiles(
  project: ProjectRecord,
  files: File[],
  ownerUid: string,
  ownerName: string,
  onProgress?: (fileName: string, progress: number) => void,
) {
  if (!files.length) return;

  const storage = getFirebaseStorage();
  const refDoc = doc(getFirebaseFirestore(), "projects", project.id);
  const currentSnapshot = await getDoc(refDoc);

  if (!currentSnapshot.exists()) {
    throw new Error("Proje bulunamadı.");
  }

  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const storagePath = `users/${ownerUid}/projects/${project.id}/${Date.now()}_${safeName}`;
    const fileRef = ref(storage, storagePath);

    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, file, {
        contentType: file.type || undefined,
        cacheControl: 'public, max-age=31536000, immutable',
      });

      task.on(
        "state_changed",
        (snapshot) => {
          if (!onProgress || snapshot.totalBytes === 0) return;
          onProgress(file.name, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        reject,
        () => resolve(),
      );
    });

    const url = await getDownloadURL(fileRef);
    const typeKey = getFileTypeKey(file.type || file.name);

    await runTransaction(getFirebaseFirestore(), async (transaction) => {
      const snapshot = await transaction.get(refDoc);

      if (!snapshot.exists()) {
        throw new Error("Proje bulunamadı.");
      }

      const data = snapshot.data();
      const currentFiles = Array.isArray(data.files) ? (data.files as ProjectFileRecord[]) : [];
      const existingIdx = currentFiles.findIndex((existingFile) => existingFile.name === file.name);
      const newFilesList = [...currentFiles];
      let sizeIncrement = file.size;
      let countIncrement = 1;

      if (existingIdx >= 0) {
        const oldFile = currentFiles[existingIdx];
        sizeIncrement = file.size - (oldFile.size || 0);
        countIncrement = 0;
        const previousVersion = {
          url: oldFile.url,
          path: oldFile.path || null,
          storageProvider: oldFile.storageProvider || "firebase",
          objectKey: oldFile.objectKey || null,
          contentType: oldFile.contentType || "",
          size: oldFile.size,
          createdAt: oldFile.createdAt || new Date().toISOString(),
          version: (oldFile.versions?.length || 0) + 1,
        };

        newFilesList[existingIdx] = {
          ...oldFile,
          url,
          path: storagePath,
          size: file.size,
          type: file.type || file.name.split(".")[1]?.toLowerCase() || "dosya",
          storageProvider: "firebase",
          contentType: file.type,
          createdAt: new Date().toISOString(),
          versions: [...(oldFile.versions || []), previousVersion],
        };
      } else {
        newFilesList.push({
          name: file.name,
          url,
          size: file.size,
          type: file.type || file.name.split(".")[1]?.toLowerCase() || "dosya",
          path: storagePath,
          storageProvider: "firebase",
          contentType: file.type,
          createdAt: new Date().toISOString(),
          versions: [],
        });
      }

      transaction.update(refDoc, {
        files: newFilesList,
        [`fileCount.${typeKey}`]: increment(countIncrement),
        totalSize: increment(sizeIncrement),
        updatedAt: serverTimestamp(),
      });
    });

    await addProjectActivityLog(project.id, {
      action: "upload",
      user: ownerName,
      details: `${file.name} dosyası yüklendi.`,
    });
  }
}

export async function hardDeleteProject(project: ProjectRecord) {
  const storage = getFirebaseStorage();
  const allFiles = [...(project.files || []), ...(project.deletedFiles || [])];

  for (const file of allFiles) {
    if (file.path) {
      await deleteObject(ref(storage, file.path)).catch(() => undefined);
    }
  }

  await deleteDoc(projectDoc(project.id));
}

export async function batchHardDeleteProjects(projects: ProjectRecord[]) {
  if (!projects.length) return;

  const storage = getFirebaseStorage();

  for (const project of projects) {
    const allFiles = [...(project.files || []), ...(project.deletedFiles || [])];

    for (const file of allFiles) {
      if (file.path) {
        await deleteObject(ref(storage, file.path)).catch(() => undefined);
      }
    }
  }

  const db = getFirebaseFirestore();
  const batch = writeBatch(db);

  for (const project of projects) {
    batch.delete(projectDoc(project.id));
  }

  await batch.commit();
}

export function watchTrashData(
  uid: string,
  onData: (data: TrashData) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    projectsCollection(),
    where("memberUids", "array-contains", uid),
    limit(100),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const allProjects = snapshot.docs.map((docSnap) => docSnap.data());

      const deletedProjects = allProjects
        .filter((project) => project.isDeleted && project.uid === uid && shouldRetainTrashItem(project.deletedAt))
        .sort((a, b) => {
          const left = formatDateValue(a.deletedAt)?.getTime() || 0;
          const right = formatDateValue(b.deletedAt)?.getTime() || 0;
          return right - left;
        });

      const activeProjectsWithDeletedFiles = allProjects.filter(
        (project) => !project.isDeleted && (project.deletedFiles?.length || 0) > 0,
      );

      // Keep client-side sorting here unless a supporting composite index is confirmed.
      const deletedFiles = mapDeletedFiles(activeProjectsWithDeletedFiles).sort((a, b) => {
        const left = formatDateValue(a.deletedAt)?.getTime() || 0;
        const right = formatDateValue(b.deletedAt)?.getTime() || 0;
        return right - left;
      });

      onData({ deletedProjects, deletedFiles });
    },
    (error) => onError(error),
  );
}

export async function fetchTrashData(uid: string): Promise<TrashData> {
  const q = query(
    projectsCollection(),
    where("memberUids", "array-contains", uid),
    limit(100),
  );
  const snapshot = await getDocs(q);
  const allProjects = snapshot.docs.map((docSnap) => docSnap.data());

  const deletedProjects = allProjects
    .filter((project) => project.isDeleted && project.uid === uid && shouldRetainTrashItem(project.deletedAt))
    .sort((a, b) => {
      const left = formatDateValue(a.deletedAt)?.getTime() || 0;
      const right = formatDateValue(b.deletedAt)?.getTime() || 0;
      return right - left;
    });

  const activeProjectsWithDeletedFiles = allProjects.filter(
    (project) => !project.isDeleted && (project.deletedFiles?.length || 0) > 0,
  );

  const deletedFiles = mapDeletedFiles(activeProjectsWithDeletedFiles).sort((a, b) => {
    const left = formatDateValue(a.deletedAt)?.getTime() || 0;
    const right = formatDateValue(b.deletedAt)?.getTime() || 0;
    return right - left;
  });

  return { deletedProjects, deletedFiles };
}

export async function restoreDeletedFile(projectId: string, file: ProjectFileRecord) {
  const refDoc = projectDoc(projectId);
  const fileId = getFileStableId(file);

  await runTransaction(getFirebaseFirestore(), async (transaction) => {
    const snapshot = await transaction.get(refDoc);

    if (!snapshot.exists()) {
      throw new Error("Proje bulunamadı.");
    }

    const data = snapshot.data();
    const deletedFiles = Array.isArray(data.deletedFiles) ? (data.deletedFiles as ProjectFileRecord[]) : [];
    const originalDeleted = deletedFiles.find(
      (deletedFile) => getFileStableId(deletedFile) === fileId,
    );

    if (!originalDeleted) {
      throw new Error("Dosya çöp kutusunda bulunamadı.");
    }

    const cleanFile = {
      ...originalDeleted,
      deletedAt: undefined,
      projectId: undefined,
      projectName: undefined,
    };
    const typeKey = getFileTypeKey(originalDeleted.type || originalDeleted.name);
    const currentFiles = Array.isArray(data.files) ? (data.files as ProjectFileRecord[]) : [];

    transaction.update(refDoc, {
      deletedFiles: arrayRemove(originalDeleted),
      files: [...currentFiles, cleanFile],
      [`fileCount.${typeKey}`]: increment(1),
      totalSize: increment(cleanFile.size || 0),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function batchRestoreFiles(items: Array<{ projectId: string; file: ProjectFileRecord }>) {
  if (!items.length) return;

  const grouped = groupTrashFileItems(items);
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);

  const projectSnapshots = await Promise.all(
    Array.from(grouped.entries()).map(async ([projectId, files]) => ({
      projectId,
      files,
      snapshot: await getDoc(projectDoc(projectId)),
    })),
  );

  for (const { projectId, files, snapshot } of projectSnapshots) {
    if (!snapshot.exists()) {
      throw new Error("Proje bulunamadı.");
    }

    const refDoc = projectDoc(projectId);
    const project = snapshot.data();
    const deletedFiles = project.deletedFiles || [];
    const filesToRestore: ProjectFileRecord[] = [];
    const nextFiles = [...(project.files || [])];
    const fileCountIncrement = { pdf: 0, dwg: 0, img: 0 };
    let totalSizeIncrement = 0;

    for (const file of files) {
      const fileId = getFileStableId(file);
      const originalDeleted = deletedFiles.find((deletedFile) => getFileStableId(deletedFile) === fileId);

      if (!originalDeleted) {
        throw new Error("Dosya çöp kutusunda bulunamadı.");
      }

      const cleanFile = cleanDeletedFile(originalDeleted);
      const typeKey = getFileTypeKey(originalDeleted.type || originalDeleted.name);

      filesToRestore.push(originalDeleted);
      nextFiles.push(cleanFile);
      fileCountIncrement[typeKey] += 1;
      totalSizeIncrement += cleanFile.size || 0;
    }

    batch.update(refDoc, {
      deletedFiles: arrayRemove(...filesToRestore),
      files: nextFiles,
      "fileCount.pdf": increment(fileCountIncrement.pdf),
      "fileCount.dwg": increment(fileCountIncrement.dwg),
      "fileCount.img": increment(fileCountIncrement.img),
      totalSize: increment(totalSizeIncrement),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function permanentlyDeleteFile(projectId: string, file: ProjectFileRecord) {
  const refDoc = projectDoc(projectId);
  const snapshot = await getDoc(refDoc);

  if (!snapshot.exists()) {
    throw new Error("Proje bulunamadı.");
  }

  const project = snapshot.data();
  const fileId = getFileStableId(file);
  const originalDeleted = (project.deletedFiles || []).find(
    (deletedFile) => getFileStableId(deletedFile) === fileId,
  );

  if (!originalDeleted) {
    throw new Error("Dosya bulunamadı.");
  }

  if (originalDeleted.path) {
    await deleteObject(ref(getFirebaseStorage(), originalDeleted.path)).catch(() => undefined);
  }

  await updateDoc(refDoc, {
    deletedFiles: arrayRemove(originalDeleted),
    updatedAt: serverTimestamp(),
  });
}

export async function batchPermanentlyDeleteFiles(items: Array<{ projectId: string; file: ProjectFileRecord }>) {
  if (!items.length) return;

  const grouped = groupTrashFileItems(items);
  const storage = getFirebaseStorage();
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);

  const projectSnapshots = await Promise.all(
    Array.from(grouped.entries()).map(async ([projectId, files]) => ({
      projectId,
      files,
      snapshot: await getDoc(projectDoc(projectId)),
    })),
  );

  const filesToDeleteFromStorage: ProjectFileRecord[] = [];

  for (const { projectId, files, snapshot } of projectSnapshots) {
    if (!snapshot.exists()) {
      throw new Error("Proje bulunamadı.");
    }

    const refDoc = projectDoc(projectId);
    const project = snapshot.data();
    const deletedFiles = project.deletedFiles || [];
    const filesToRemove: ProjectFileRecord[] = [];

    for (const file of files) {
      const fileId = getFileStableId(file);
      const originalDeleted = deletedFiles.find((deletedFile) => getFileStableId(deletedFile) === fileId);

      if (!originalDeleted) {
        throw new Error("Dosya bulunamadı.");
      }

      filesToRemove.push(originalDeleted);
      filesToDeleteFromStorage.push(originalDeleted);
    }

    batch.update(refDoc, {
      deletedFiles: arrayRemove(...filesToRemove),
      updatedAt: serverTimestamp(),
    });
  }

  for (const file of filesToDeleteFromStorage) {
    if (file.path) {
      await deleteObject(ref(storage, file.path)).catch(() => undefined);
    }
  }

  await batch.commit();
}
