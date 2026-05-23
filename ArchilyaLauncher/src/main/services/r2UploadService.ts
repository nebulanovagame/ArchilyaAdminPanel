import fs from 'fs';
import axios from 'axios';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '../firebase';

const createR2UploadUrlSecureCallable = httpsCallable(functions, 'createR2UploadUrlSecure');
const R2_SIZE_THRESHOLD_BYTES = 50 * 1024 * 1024;
const R2_EXTENSIONS = new Set(['pak', 'utoc', 'ucas', 'mp4', 'mov', 'avi', 'mkv', 'zip', 'rar', '7z', 'glb', 'gltf', 'fbx', 'obj', 'blend', 'usdz']);

export interface R2UploadUrlResponse {
  success: boolean;
  uploadUrl?: string;
  objectKey?: string;
  pseudoUrl?: string;
}

const DEFAULT_ALLOWED_R2_HOST_SUFFIXES = ['.r2.cloudflarestorage.com', '.cloudflarestorage.com'];

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function getExtension(fileName = '') {
  const parts = String(fileName || '').split('.');
  return parts.length > 1 ? String(parts.pop() || '').toLowerCase() : '';
}

function getLoopbackHosts() {
  return new Set(['localhost', '127.0.0.1', '::1']);
}

function getConfiguredAllowedHosts() {
  return String(process.env.ARCHILYA_R2_UPLOAD_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedR2Host(hostname: string, expectedPublicUrl?: string) {
  const normalizedHost = hostname.toLowerCase();
  const configuredHosts = getConfiguredAllowedHosts();

  if (configuredHosts.includes(normalizedHost)) {
    return true;
  }

  if (DEFAULT_ALLOWED_R2_HOST_SUFFIXES.some((suffix) => normalizedHost === suffix.slice(1) || normalizedHost.endsWith(suffix))) {
    return true;
  }

  const normalizedPublicUrl = normalizeText(expectedPublicUrl);
  if (normalizedPublicUrl.startsWith('https://')) {
    try {
      const publicUrlHost = new URL(normalizedPublicUrl).hostname.toLowerCase();
      if (configuredHosts.includes(publicUrlHost)) {
        return normalizedHost === publicUrlHost;
      }
    } catch {
      return false;
    }
  }

  return false;
}

function getValidatedUploadUrl(uploadUrl: string, expectedPublicUrl?: string): string {
  const parsedUrl = new URL(uploadUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  const isLoopbackHost = getLoopbackHosts().has(hostname);
  const isAllowedProtocol = parsedUrl.protocol === 'https:' || (isLoopbackHost && parsedUrl.protocol === 'http:');

  if (!isAllowedProtocol) {
    throw new Error('Gecersiz R2 upload hedefi.');
  }

  if (!isLoopbackHost && !isAllowedR2Host(hostname, expectedPublicUrl)) {
    throw new Error('Beklenmeyen R2 upload hedefi.');
  }

  return parsedUrl.toString();
}

export function shouldUseR2Upload({ fileName = '', fileSize = 0, contentType = '' } = {}) {
  const ext = getExtension(fileName);
  const normalizedType = String(contentType || '').toLowerCase();
  const largeBySize = Number(fileSize || 0) >= R2_SIZE_THRESHOLD_BYTES;
  const heavyByExt = R2_EXTENSIONS.has(ext);
  const heavyByType = /video|octet-stream|model/.test(normalizedType);
  return largeBySize || heavyByExt || heavyByType;
}

export async function createR2UploadUrlSecure(payload: Record<string, unknown>): Promise<R2UploadUrlResponse> {
  if (!auth.currentUser) {
    throw new Error('Oturum açmanız gerekiyor.');
  }

  const result = await createR2UploadUrlSecureCallable(payload || {});
  const data = result?.data;
  if (!data || typeof data !== 'object') {
    return { success: false };
  }

  const response = data as Partial<R2UploadUrlResponse>;
  return {
    success: response.success === true,
    uploadUrl: typeof response.uploadUrl === 'string' ? response.uploadUrl : undefined,
    objectKey: typeof response.objectKey === 'string' ? response.objectKey : undefined,
    pseudoUrl: typeof response.pseudoUrl === 'string' ? response.pseudoUrl : undefined,
  };
}

export async function uploadFilePathToSignedUrl(
  uploadUrl: string,
  localFilePath: string,
  contentType = 'application/octet-stream',
  expectedPublicUrl?: string,
) {
  const normalizedUploadUrl = normalizeText(uploadUrl);
  const safeLocalFilePath = normalizeText(localFilePath);

  if (!normalizedUploadUrl || !safeLocalFilePath) {
    throw new Error('R2 upload bilgileri eksik.');
  }

  const safeUploadUrl = getValidatedUploadUrl(normalizedUploadUrl, expectedPublicUrl);

  const stats = await fs.promises.stat(safeLocalFilePath);
  const stream = fs.createReadStream(safeLocalFilePath, { highWaterMark: 1024 * 1024 });

  try {
    const response = await axios.put(safeUploadUrl, stream, {
      headers: {
        'Content-Type': String(contentType || 'application/octet-stream'),
        'Content-Length': String(stats.size),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    return {
      success: true,
      status: response.status,
      size: Number(stats.size || 0),
    };
  } finally {
    stream.destroy();
  }
}
