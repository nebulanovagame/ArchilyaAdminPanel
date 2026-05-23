import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { addProjectFileSecure, type ProjectFilePayload, updateProjectSecure } from './entitlementService';
import { captureException } from './errorTracking';
import {
  createR2UploadUrlSecure,
  type CreateR2UploadUrlResponse,
  shouldUseR2Upload,
  uploadLocalUriToSignedUrl,
} from './r2StorageService';
import {
  resolveFileExtension,
  resolveMimeTypeFromExtension,
} from '../utils/fileUtils';

const PROJECT_UPLOAD_QUEUE_KEY = 'archilya_project_upload_queue_v1';
const QUEUE_DIRECTORY = `${FileSystem.documentDirectory || ''}project-upload-queue/`;

type QueuePhase = 'pending_binary' | 'pending_commit';

type QueueUploadPayload = {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string | null;
  storageProvider: 'firebase' | 'r2';
  objectKey: string | null;
  contentType: string;
  createdAt: string;
};

export type ProjectUploadQueueItem = {
  id: string;
  signalId: string;
  userId: string;
  projectId: string;
  localUri: string;
  name: string;
  mimeType: string;
  contentType: string;
  size: number;
  folderId: string | null;
  phase: QueuePhase;
  upload: QueueUploadPayload | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError: string;
};

type EnqueueAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

type QueueFilter = {
  userId?: string;
  projectId?: string;
};

type UploadSignalRecord = {
  id?: string;
  [key: string]: unknown;
};

const queueListeners = new Set<() => void>();
let drainPromise: Promise<{ processed: number; remaining: number }> | null = null;

function emitQueueChange() {
  queueListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Listener notification should never break queue writes.
    }
  });
}

function normalizeFolderId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function createQueueItemId(): string {
  return `upl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSignalId(): string {
  return `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeExtension(ext = 'bin'): string {
  return String(ext || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
}

async function ensureQueueDirectory(): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error('Kalici yukleme alani bulunamadi.');
  }

  await FileSystem.makeDirectoryAsync(QUEUE_DIRECTORY, { intermediates: true }).catch(() => null);
}

async function readQueue(): Promise<ProjectUploadQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECT_UPLOAD_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProjectUploadQueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: ProjectUploadQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(PROJECT_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
  emitQueueChange();
}

async function resolveLocalFileSize(localUri: string, hintedSize?: number | null): Promise<number> {
  const direct = Number(hintedSize || 0);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const info = await FileSystem.getInfoAsync(localUri);
  const size = info.exists && 'size' in info ? Number(info.size || 0) : 0;
  return Number.isFinite(size) ? size : 0;
}

function estimateBase64Bytes(base64 = ''): number {
  const value = String(base64 || '').trim();
  if (!value) return 0;
  return Math.floor((value.length * 3) / 4);
}

function isContentUri(uri = ''): boolean {
  return /^content:\/\//i.test(String(uri || '').trim());
}

function buildTempUploadPath(ext = 'bin'): string {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Gecici dosya alani bulunamadi.');
  }

  return `${cacheDir}project-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${sanitizeExtension(ext)}`;
}

async function readAssetAsDataUrl(uri: string, mimeTypeHint: string, extHint: string): Promise<{ dataUrl: string; size: number }> {
  let sourceUri = uri;
  let cleanupUri = '';

  try {
    if (isContentUri(uri)) {
      sourceUri = buildTempUploadPath(extHint);
      cleanupUri = sourceUri;
      await FileSystem.copyAsync({ from: uri, to: sourceUri });
    }

    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = String(mimeTypeHint || '').toLowerCase() || resolveMimeTypeFromExtension(extHint);
    return {
      dataUrl: `data:${mimeType};base64,${base64}`,
      size: estimateBase64Bytes(base64),
    };
  } finally {
    if (cleanupUri) {
      FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => null);
    }
  }
}

async function uploadAssetToFirebase(
  localUri: string,
  destinationPath: string,
  contentType: string,
  extHint: string
): Promise<{ size: number; url: string }> {
  const storageRef = ref(storage, destinationPath);

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob);
    return {
      size: Number(blob.size || 0),
      url: await getDownloadURL(storageRef),
    };
  } catch {
    const fallback = await readAssetAsDataUrl(localUri, contentType, extHint);
    await uploadString(storageRef, fallback.dataUrl, 'data_url');
    return {
      size: fallback.size,
      url: await getDownloadURL(storageRef),
    };
  }
}

async function persistAssetForQueue(asset: EnqueueAsset, queueItemId: string): Promise<string> {
  await ensureQueueDirectory();

  const ext = resolveFileExtension(asset.name, asset.mimeType || '');
  const targetUri = `${QUEUE_DIRECTORY}${queueItemId}.${sanitizeExtension(ext)}`;
  await FileSystem.copyAsync({ from: asset.uri, to: targetUri });
  return targetUri;
}

function matchesQueueFilter(item: ProjectUploadQueueItem, filter: QueueFilter = {}): boolean {
  if (filter.userId && item.userId !== filter.userId) return false;
  if (filter.projectId && item.projectId !== filter.projectId) return false;
  return true;
}

function buildFileDoc(item: ProjectUploadQueueItem): ProjectFilePayload {
  if (!item.upload) {
    throw new Error('Yukleme metaverisi hazir degil.');
  }

  return {
    name: item.upload.name,
    size: item.upload.size,
    type: item.upload.type,
    url: item.upload.url,
    path: item.upload.path,
    storageProvider: item.upload.storageProvider,
    objectKey: item.upload.objectKey,
    contentType: item.upload.contentType,
    folderId: item.folderId,
    createdAt: item.upload.createdAt,
  };
}

function isUploadSignalRecord(value: unknown): value is UploadSignalRecord {
  return Boolean(value && typeof value === 'object');
}

function getSignalId(signal: UploadSignalRecord): string {
  return String(signal.id || '');
}

async function readProjectUploadSignals(projectId: string): Promise<UploadSignalRecord[]> {
  const snapshot = await getDoc(doc(db, 'projects', projectId));
  if (!snapshot.exists()) return [];
  const projectData = snapshot.data() || {};
  return Array.isArray(projectData.uploadSignals) ? projectData.uploadSignals.filter(isUploadSignalRecord) : [];
}

function buildUploadSignal(item: ProjectUploadQueueItem, status: 'uploading' | 'failed', lastError = ''): UploadSignalRecord {
  return {
    id: item.signalId,
    userId: item.userId,
    projectId: item.projectId,
    name: item.name,
    size: item.size,
    contentType: item.contentType,
    folderId: item.folderId,
    storageProvider: item.upload?.storageProvider || (shouldUseR2Upload({ fileName: item.name, fileSize: item.size, contentType: item.contentType }) ? 'r2' : 'firebase'),
    phase: item.phase,
    status,
    createdAt: item.createdAt,
    updatedAt: new Date().toISOString(),
    lastError: String(lastError || '').slice(0, 500),
  };
}

async function upsertProjectUploadSignal(item: ProjectUploadQueueItem, status: 'uploading' | 'failed', lastError = ''): Promise<void> {
  const currentSignals = await readProjectUploadSignals(item.projectId);
  const nextSignal = buildUploadSignal(item, status, lastError);
  const nextSignals = currentSignals.some((signal) => getSignalId(signal) === item.signalId)
    ? currentSignals.map((signal) => (getSignalId(signal) === item.signalId ? { ...signal, ...nextSignal } : signal))
    : [...currentSignals, nextSignal];

  const result = await updateProjectSecure(item.projectId, { uploadSignals: nextSignals });
  if (!result?.success) {
    throw new Error(result?.message || 'Yukleme sinyali guncellenemedi.');
  }
}

async function clearProjectUploadSignal(item: ProjectUploadQueueItem): Promise<void> {
  const currentSignals = await readProjectUploadSignals(item.projectId);
  const nextSignals = currentSignals.filter((signal) => getSignalId(signal) !== item.signalId);
  const result = await updateProjectSecure(item.projectId, { uploadSignals: nextSignals });
  if (!result?.success) {
    throw new Error(result?.message || 'Yukleme sinyali temizlenemedi.');
  }
}

async function performBinaryUpload(item: ProjectUploadQueueItem): Promise<QueueUploadPayload> {
  const ext = resolveFileExtension(item.name, item.mimeType || '');
  const safeName = item.name || `upload-${Date.now()}.${ext}`;
  const contentType = String(item.contentType || item.mimeType || resolveMimeTypeFromExtension(ext) || 'application/octet-stream').toLowerCase();
  const estimatedSize = Number(item.size || 0);

  if (shouldUseR2Upload({ fileName: safeName, fileSize: estimatedSize, contentType })) {
    if (!estimatedSize) {
      throw new Error('R2 yukleme icin dosya boyutu tespit edilemedi.');
    }

    const uploadMeta: CreateR2UploadUrlResponse = await createR2UploadUrlSecure({
      projectId: item.projectId,
      fileName: safeName,
      fileSize: estimatedSize,
      contentType,
    });

    if (!uploadMeta?.success || !uploadMeta?.uploadUrl || !uploadMeta?.objectKey) {
      throw new Error('R2 upload URL olusturulamadi.');
    }

    const uploadResult = await uploadLocalUriToSignedUrl(uploadMeta.uploadUrl, item.localUri, contentType);
    const objectKey = String(uploadMeta.objectKey || '').trim() || null;
    return {
      name: safeName,
      size: Number(uploadResult?.size || estimatedSize || 0),
      type: ext,
      url: String(uploadMeta.pseudoUrl || (objectKey ? `r2://${objectKey}` : '')).trim(),
      path: null,
      storageProvider: 'r2',
      objectKey,
      contentType,
      createdAt: new Date().toISOString(),
    };
  }

  const uploadPath = `users/${item.userId}/projects/${item.projectId}/${Date.now()}_${safeName}`;
  const uploaded = await uploadAssetToFirebase(item.localUri, uploadPath, contentType, ext);
  return {
    name: safeName,
    size: Number(uploaded.size || estimatedSize || 0),
    type: ext,
    url: uploaded.url,
    path: uploadPath,
    storageProvider: 'firebase',
    objectKey: null,
    contentType,
    createdAt: new Date().toISOString(),
  };
}

async function cleanupQueuedFile(localUri: string): Promise<void> {
  if (!localUri) return;
  await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => null);
}

export function subscribeProjectUploadQueue(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

export async function listProjectUploadQueue(filter: QueueFilter = {}): Promise<ProjectUploadQueueItem[]> {
  const queue = await readQueue();
  return queue.filter((item) => matchesQueueFilter(item, filter));
}

export async function enqueueProjectUpload({
  asset,
  projectId,
  userId,
  folderId,
}: {
  asset: EnqueueAsset;
  projectId: string;
  userId: string;
  folderId?: string | null;
}): Promise<ProjectUploadQueueItem> {
  if (!projectId || !userId) {
    throw new Error('Yukleme kuyrugu icin proje ve kullanici bilgisi gerekli.');
  }

  if (!asset?.uri) {
    throw new Error('Yuklenecek dosya bulunamadi.');
  }

  const queueItemId = createQueueItemId();
  const localUri = await persistAssetForQueue(asset, queueItemId);
  const fileSize = await resolveLocalFileSize(localUri, asset.size);
  const ext = resolveFileExtension(asset.name, asset.mimeType || '');
  const mimeType = String(asset.mimeType || resolveMimeTypeFromExtension(ext) || 'application/octet-stream').toLowerCase();
  const now = new Date().toISOString();

  const queueItem: ProjectUploadQueueItem = {
    id: queueItemId,
    signalId: createSignalId(),
    userId,
    projectId,
    localUri,
    name: asset.name || `upload-${Date.now()}.${ext}`,
    mimeType,
    contentType: mimeType,
    size: fileSize,
    folderId: normalizeFolderId(folderId),
    phase: 'pending_binary',
    upload: null,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastError: '',
  };

  const queue = await readQueue();
  queue.push(queueItem);
  await writeQueue(queue);

  return queueItem;
}

export async function drainProjectUploadQueue({
  userId,
  projectId,
  reason = 'manual',
}: {
  userId?: string;
  projectId?: string;
  reason?: string;
} = {}): Promise<{ processed: number; remaining: number }> {
  if (drainPromise) {
    return drainPromise;
  }

  drainPromise = (async () => {
    let queue = await readQueue();
    let processed = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const currentItem = queue[index];
      if (!matchesQueueFilter(currentItem, { userId, projectId })) {
        continue;
      }

      let attemptItem = currentItem;

      try {
        await upsertProjectUploadSignal(attemptItem, 'uploading');

        if (currentItem.phase === 'pending_binary') {
          const upload = await performBinaryUpload(currentItem);
          attemptItem = {
            ...currentItem,
            phase: 'pending_commit',
            upload,
            updatedAt: new Date().toISOString(),
            attempts: Number(currentItem.attempts || 0) + 1,
            lastError: '',
          };
          queue[index] = attemptItem;
          await writeQueue(queue);
        }

        const commitResult = await addProjectFileSecure(attemptItem.projectId, buildFileDoc(attemptItem));
        if (!commitResult?.success) {
          throw new Error(commitResult?.message || 'Dosya kaydi tamamlanamadi.');
        }

        await clearProjectUploadSignal(attemptItem);
        await cleanupQueuedFile(attemptItem.localUri);
        queue = queue.filter((item) => item.id !== attemptItem.id);
        index -= 1;
        processed += 1;
        await writeQueue(queue);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Dosya yuklenemedi.';
        captureException(error, {
          scope: 'mobile_project_upload_queue',
          reason,
          phase: attemptItem.phase,
          project_id: attemptItem.projectId,
          storage_provider: attemptItem.upload?.storageProvider || 'pending',
        });

        queue[index] = {
          ...attemptItem,
          updatedAt: new Date().toISOString(),
          attempts: Number(attemptItem.attempts || 0) + 1,
          lastError: String(message || 'Dosya yuklenemedi.').slice(0, 500),
        };
        await upsertProjectUploadSignal(queue[index], 'failed', queue[index].lastError).catch(() => null);
        await writeQueue(queue);
      }
    }

    return {
      processed,
      remaining: queue.filter((item) => matchesQueueFilter(item, { userId, projectId })).length,
    };
  })().finally(() => {
    drainPromise = null;
  });

  return drainPromise;
}
