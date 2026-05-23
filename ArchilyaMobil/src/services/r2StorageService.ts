import { getFunctions, httpsCallable, type HttpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app } from '../config/firebase';
import { type CallableResponse } from '../types';

type UnknownRecord = Record<string, unknown>;
type R2CallableResponse<T = UnknownRecord> = CallableResponse<T> & UnknownRecord;

type R2UploadDecisionInput = {
  fileName?: string;
  fileSize?: number;
  contentType?: string;
};

export type CreateR2UploadUrlPayload = {
  projectId?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
} & UnknownRecord;

export type CreateR2UploadUrlResponse = R2CallableResponse & {
  uploadUrl?: string;
  objectKey?: string;
  pseudoUrl?: string;
};

export type CreateR2DownloadUrlPayload = {
  projectId?: string;
  objectKey?: string;
  fileName?: string;
  disposition?: 'inline' | 'attachment' | string;
} & UnknownRecord;

export type CreateR2DownloadUrlResponse = R2CallableResponse & {
  downloadUrl?: string;
};

export type DeleteR2ObjectPayload = {
  projectId?: string;
  objectKey?: string;
} & UnknownRecord;

export type UploadSignedUrlResult = {
  success: true;
  status: number;
  size: number;
};

const functions = getFunctions(app, 'europe-west1');

const createR2UploadUrlSecureCallable: HttpsCallable<CreateR2UploadUrlPayload, CreateR2UploadUrlResponse> = httpsCallable(
  functions,
  'createR2UploadUrlSecure'
);
const createR2DownloadUrlSecureCallable: HttpsCallable<CreateR2DownloadUrlPayload, CreateR2DownloadUrlResponse> = httpsCallable(
  functions,
  'createR2DownloadUrlSecure'
);
const deleteR2ObjectSecureCallable: HttpsCallable<DeleteR2ObjectPayload, R2CallableResponse> = httpsCallable(
  functions,
  'deleteR2ObjectSecure'
);

const R2_SIZE_THRESHOLD_BYTES = 50 * 1024 * 1024;
const R2_EXTENSIONS = new Set(['pak', 'utoc', 'ucas', 'mp4', 'mov', 'avi', 'mkv', 'zip', 'rar', '7z', 'glb', 'gltf', 'fbx', 'obj', 'blend', 'usdz']);

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim();
}

function getExtension(fileName = ''): string {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? String(parts.pop() || '').toLowerCase() : '';
}

function extractCallableData<R extends R2CallableResponse>(result: HttpsCallableResult<R> | null | undefined): R {
  return result?.data || ({ success: false } as R);
}

export function shouldUseR2Upload({ fileName = '', fileSize = 0, contentType = '' }: R2UploadDecisionInput = {}): boolean {
  const ext = getExtension(fileName);
  const normalizedType = String(contentType || '').toLowerCase();
  const largeBySize = Number(fileSize || 0) >= R2_SIZE_THRESHOLD_BYTES;
  const heavyByExt = R2_EXTENSIONS.has(ext);
  const heavyByType = /video|octet-stream|model/.test(normalizedType);
  return largeBySize || heavyByExt || heavyByType;
}

export async function createR2UploadUrlSecure(payload: CreateR2UploadUrlPayload): Promise<CreateR2UploadUrlResponse> {
  const result = await createR2UploadUrlSecureCallable(payload || {});
  return extractCallableData(result);
}

export async function createR2DownloadUrlSecure(payload: CreateR2DownloadUrlPayload): Promise<CreateR2DownloadUrlResponse> {
  const result = await createR2DownloadUrlSecureCallable(payload || {});
  return extractCallableData(result);
}

export async function deleteR2ObjectSecure(payload: DeleteR2ObjectPayload): Promise<R2CallableResponse> {
  const result = await deleteR2ObjectSecureCallable(payload || {});
  return extractCallableData(result);
}

export async function uploadLocalUriToSignedUrl(
  uploadUrl: string,
  localUri: string,
  contentType = 'application/octet-stream'
): Promise<UploadSignedUrlResult> {
  const safeUploadUrl = normalizeText(uploadUrl);
  const safeLocalUri = normalizeText(localUri);

  if (!safeUploadUrl || !safeLocalUri) {
    throw new Error('R2 upload bilgileri eksik.');
  }

  let blob: Blob;
  try {
    const localResponse = await fetch(safeLocalUri);
    blob = await localResponse.blob();
  } catch {
    throw new Error('R2 yukleme icin dosya okunamadi.');
  }

  const response = await fetch(safeUploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': String(contentType || 'application/octet-stream'),
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`R2 upload hatasi (${response.status})`);
  }

  return {
    success: true,
    status: response.status,
    size: Number(blob?.size || 0),
  };
}
