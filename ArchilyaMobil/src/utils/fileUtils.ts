const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
const CAD_EXTENSIONS = ['dwg', 'dxf', 'ifc', 'rvt'];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z'];
const DOCUMENT_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];

export type FileLike = {
  type?: string | null;
  mimeType?: string | null;
  name?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function getFileExtension(name = ''): string {
  const normalized = normalizeText(name);
  if (!normalized.includes('.')) return '';
  return normalized.split('.').pop() || '';
}

export function resolveFileExtension(name = '', mimeType = '', typeHint = ''): string {
  const extFromName = getFileExtension(name);
  if (extFromName) return extFromName;

  const normalizedHint = normalizeText(typeHint);
  if (normalizedHint && !normalizedHint.includes('/')) {
    return normalizedHint;
  }

  const normalizedMime = normalizeText(mimeType);
  if (!normalizedMime) return 'bin';
  if (normalizedMime.includes('pdf')) return 'pdf';
  if (normalizedMime.includes('jpeg') || normalizedMime.includes('jpg')) return 'jpg';
  if (normalizedMime.includes('png')) return 'png';
  if (normalizedMime.includes('webp')) return 'webp';
  if (normalizedMime.includes('gif')) return 'gif';
  if (normalizedMime.includes('mp4')) return 'mp4';
  if (normalizedMime.includes('zip')) return 'zip';
  if (normalizedMime.includes('dwg')) return 'dwg';
  if (normalizedMime.includes('dxf')) return 'dxf';
  return 'bin';
}

export function resolveMimeTypeFromExtension(ext = ''): string {
  const normalized = normalizeText(ext);
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'png') return 'image/png';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'gif') return 'image/gif';
  if (normalized === 'pdf') return 'application/pdf';
  if (normalized === 'mp4') return 'video/mp4';
  return 'application/octet-stream';
}

export function resolveMimeTypeFromFile(fileType = '', fileName = ''): string {
  const normalizedType = normalizeText(fileType);
  if (normalizedType.includes('/')) {
    return normalizedType;
  }

  const extension = resolveFileExtension(fileName, '', normalizedType);
  return resolveMimeTypeFromExtension(extension);
}

export function resolveFileCategory(fileType = '', fileName = ''): string {
  const normalizedType = normalizeText(fileType);
  if (normalizedType.startsWith('image/')) return 'image';
  if (normalizedType.startsWith('video/')) return 'video';
  if (normalizedType.includes('pdf')) return 'pdf';

  const ext = resolveFileExtension(fileName, '', normalizedType);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (CAD_EXTENSIONS.includes(ext)) return 'cad';
  if (ARCHIVE_EXTENSIONS.includes(ext)) return 'archive';
  if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document';
  return 'unknown';
}

export function isImageFileLike(file: FileLike = {}): boolean {
  const type = String(file?.type || file?.mimeType || '').trim();
  const name = String(file?.name || '').trim();
  return resolveFileCategory(type, name) === 'image';
}

export function getCategoryLabel(category: string): string {
  if (category === 'image') return 'Gorsel';
  if (category === 'pdf') return 'PDF';
  if (category === 'video') return 'Video';
  if (category === 'cad') return 'CAD';
  if (category === 'archive') return 'Arsiv';
  if (category === 'document') return 'Dokuman';
  return 'Dosya';
}

export function formatFileSize(bytes: number | string | null | undefined): string {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** power;
  return `${size.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

export function buildPdfViewerUrl(url = ''): string {
  const trimmedUrl = String(url || '').trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl;
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(trimmedUrl)}`;
}
