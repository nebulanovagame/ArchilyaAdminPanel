import { arrayUnion, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { auth, db } from '../firebase';

export type UploadSignalPayload = {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  size: number;
  contentType: string;
  folderId: string | null;
  storageProvider: 'firebase' | 'r2';
  status: 'uploading' | 'failed';
  lastError?: string;
};

async function readSignals(projectId: string) {
  const snapshot = await getDoc(doc(db, 'projects', projectId));
  if (!snapshot.exists()) return [];
  const data = snapshot.data() || {};
  return Array.isArray(data.uploadSignals) ? data.uploadSignals : [];
}

function sanitizeSignalError(errorMessage?: string) {
  return String(errorMessage || '')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\br2:\/\/\S+/gi, '[r2]')
    .replace(/[A-Za-z]:\\[^\s"'`]+/g, '[path]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function actorLabel() {
  return auth.currentUser?.displayName || auth.currentUser?.email || auth.currentUser?.uid || 'Launcher';
}

export async function upsertProjectUploadSignal(signal: UploadSignalPayload) {
  const currentSignals = await readSignals(signal.projectId);
  const nextSignal = {
    ...signal,
    updatedAt: new Date().toISOString(),
    lastError: sanitizeSignalError(signal.lastError),
  };

  const nextSignals = currentSignals.some((item) => String(item?.id || '') === signal.id)
    ? currentSignals.map((item) => (String(item?.id || '') === signal.id ? { ...item, ...nextSignal } : item))
    : [...currentSignals, nextSignal];

  await updateDoc(doc(db, 'projects', signal.projectId), {
    uploadSignals: nextSignals,
    activityLog: arrayUnion({
      action: 'upload_signal',
      user: actorLabel(),
      timestamp: new Date().toISOString(),
      details: `${signal.name} için ${signal.status} sinyali yazıldı (Launcher)`,
    }),
    updatedAt: serverTimestamp(),
  });
}

export async function clearProjectUploadSignal(projectId: string, signalId: string) {
  const currentSignals = await readSignals(projectId);
  const nextSignals = currentSignals.filter((item) => String(item?.id || '') !== signalId);

  await updateDoc(doc(db, 'projects', projectId), {
    uploadSignals: nextSignals,
    activityLog: arrayUnion({
      action: 'upload_signal_clear',
      user: actorLabel(),
      timestamp: new Date().toISOString(),
      details: `${signalId} sinyali temizlendi (Launcher)`,
    }),
    updatedAt: serverTimestamp(),
  });
}
