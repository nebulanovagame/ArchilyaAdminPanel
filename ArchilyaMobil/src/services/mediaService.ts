import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { type PickedFile } from '../types';

type ImageManipulatorAction = NonNullable<Parameters<typeof ImageManipulator.manipulateAsync>[1]>[number];

type RawPickedFile = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AI_SOURCE_DOCUMENT_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'];
const OPTIMIZED_MAX_DIMENSION = 2048;
const OPTIMIZED_QUALITY = 0.84;

const PROJECT_DOCUMENT_TYPES = [
  'application/pdf',
  'image/*',
  'video/mp4',
  'application/zip',
  'application/octet-stream',
];

function normalizeFileName(rawName: string | null | undefined, fallback = 'file'): string {
  const value = String(rawName || '').trim();
  if (!value) {
    return `${fallback}-${Date.now()}`;
  }
  return value;
}

function normalizeMimeType(rawMimeType: string | null | undefined, fallback = 'application/octet-stream'): string {
  const value = String(rawMimeType || '').trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'image/jpg') return 'image/jpeg';
  return value;
}

function ensureJpegFileName(name: string | null | undefined, fallbackName = 'image'): string {
  const normalized = normalizeFileName(name, fallbackName);
  if (normalized.toLowerCase().endsWith('.jpg') || normalized.toLowerCase().endsWith('.jpeg')) {
    return normalized;
  }

  const clean = normalized.includes('.') ? normalized.substring(0, normalized.lastIndexOf('.')) : normalized;
  return `${clean || fallbackName}-${Date.now()}.jpg`;
}

function buildResizeAction(width: number | null | undefined, height: number | null | undefined): ImageManipulatorAction | null {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;

  const longest = Math.max(w, h);
  if (longest <= OPTIMIZED_MAX_DIMENSION) return null;

  if (w >= h) {
    return { resize: { width: OPTIMIZED_MAX_DIMENSION } };
  }

  return { resize: { height: OPTIMIZED_MAX_DIMENSION } };
}

async function optimizeImageFile(
  file: RawPickedFile,
  fallbackName: string,
  width?: number | null,
  height?: number | null
): Promise<PickedFile> {
  const mimeType = normalizeMimeType(file.mimeType || 'image/jpeg', 'image/jpeg');
  if (!mimeType.startsWith('image/')) {
    return buildPickedFile(file, fallbackName);
  }

  try {
    const resizeAction = buildResizeAction(width, height);
    const actions = resizeAction ? [resizeAction] : [];

    const optimized = await ImageManipulator.manipulateAsync(file.uri, actions, {
      compress: OPTIMIZED_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    });

    return buildPickedFile(
      {
        uri: optimized.uri,
        name: ensureJpegFileName(file.name, fallbackName),
        mimeType: 'image/jpeg',
        size: file.size,
      },
      fallbackName
    );
  } catch {
    return buildPickedFile(file, fallbackName);
  }
}

function buildPickedFile({ uri, name, mimeType, size }: RawPickedFile, fallbackName: string): PickedFile {
  return {
    uri,
    name: normalizeFileName(name, fallbackName),
    mimeType: normalizeMimeType(mimeType),
    size: Number(size || 0),
  };
}

async function ensureCameraPermission(): Promise<void> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Kamera izni gerekli. Lutfen cihaz ayarlarindan izin verin.');
  }
}

async function ensureLibraryPermission(): Promise<void> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Galeri izni gerekli. Lutfen cihaz ayarlarindan izin verin.');
  }
}

export async function captureImageWithCamera(): Promise<PickedFile | null> {
  await ensureCameraPermission();

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.92,
    exif: false,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return optimizeImageFile(
    {
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    },
    'camera',
    asset.width,
    asset.height
  );
}

export async function pickImageFromLibrary(): Promise<PickedFile | null> {
  await ensureLibraryPermission();

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.92,
    exif: false,
    selectionLimit: 1,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return optimizeImageFile(
    {
      uri: asset.uri,
      name: asset.fileName,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    },
    'gallery',
    asset.width,
    asset.height
  );
}

export async function pickImageFromDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: IMAGE_MIME_TYPES,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return optimizeImageFile(
    {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.size,
    },
    'image',
    0,
    0
  );
}

export async function pickAiSourceFromDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: AI_SOURCE_DOCUMENT_TYPES,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  const normalizedMimeType = normalizeMimeType(asset.mimeType || 'application/octet-stream');
  if (normalizedMimeType === 'application/pdf') {
    return buildPickedFile(
      {
        uri: asset.uri,
        name: asset.name,
        mimeType: normalizedMimeType,
        size: asset.size,
      },
      'pdf'
    );
  }

  return optimizeImageFile(
    {
      uri: asset.uri,
      name: asset.name,
      mimeType: normalizedMimeType,
      size: asset.size,
    },
    'image',
    0,
    0
  );
}

export async function pickProjectFileFromDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: PROJECT_DOCUMENT_TYPES,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return buildPickedFile(
    {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      size: asset.size,
    },
    'document'
  );
}
