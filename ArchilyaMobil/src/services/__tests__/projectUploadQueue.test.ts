/// <reference types="jest" />

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ size: 2048 }),
  readAsStringAsync: jest.fn().mockResolvedValue('YmFzZTY0'),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, collectionName, id) => ({ db, collectionName, id })),
  getDoc: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((storage, path) => ({ storage, path })),
  uploadBytes: jest.fn().mockResolvedValue(undefined),
  uploadString: jest.fn().mockResolvedValue(undefined),
  getDownloadURL: jest.fn().mockResolvedValue('https://firebase.example/file.jpg'),
}));

jest.mock('../entitlementService', () => ({
  addProjectFileSecure: jest.fn(),
  updateProjectSecure: jest.fn(),
}));

jest.mock('../r2StorageService', () => ({
  createR2UploadUrlSecure: jest.fn(),
  shouldUseR2Upload: jest.fn(),
  uploadLocalUriToSignedUrl: jest.fn(),
}));

jest.mock('../errorTracking', () => ({
  captureException: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({
  db: {},
  storage: {},
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { getDoc } from 'firebase/firestore';

import { addProjectFileSecure, updateProjectSecure } from '../entitlementService';
import {
  createR2UploadUrlSecure,
  shouldUseR2Upload,
  uploadLocalUriToSignedUrl,
} from '../r2StorageService';
import { drainProjectUploadQueue, enqueueProjectUpload } from '../projectUploadQueue';

describe('projectUploadQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ uploadSignals: [] }) });
    (updateProjectSecure as jest.Mock).mockResolvedValue({ success: true });
    (addProjectFileSecure as jest.Mock).mockResolvedValue({ success: true });
    (shouldUseR2Upload as jest.Mock).mockReturnValue(true);
    (createR2UploadUrlSecure as jest.Mock).mockResolvedValue({
      success: true,
      uploadUrl: 'https://r2.example/upload',
      objectKey: 'objects/demo',
      pseudoUrl: 'r2://objects/demo',
    });
    (uploadLocalUriToSignedUrl as jest.Mock).mockResolvedValue({ success: true, size: 2048 });
  });

  it('persists queue items to AsyncStorage when offline asset is enqueued', async () => {
    const item = await enqueueProjectUpload({
      asset: {
        uri: 'file:///source/demo.jpg',
        name: 'demo.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
      },
      projectId: 'project-1',
      userId: 'user-1',
      folderId: null,
    });

    expect(item.projectId).toBe('project-1');
    expect(item.signalId).toMatch(/^uploading_/);
    expect(FileSystem.copyAsync).toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const persistedPayload = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(persistedPayload[0].phase).toBe('pending_binary');
    expect(persistedPayload[0].localUri).toContain('project-upload-queue');
  });

  it('writes uploading signal before commit and clears it after success', async () => {
    const queuedItem = {
      id: 'upl_1',
      signalId: 'uploading_1',
      userId: 'user-1',
      projectId: 'project-1',
      localUri: 'file:///documents/project-upload-queue/upl_1.jpg',
      name: 'demo.jpg',
      mimeType: 'image/jpeg',
      contentType: 'image/jpeg',
      size: 2048,
      folderId: null,
      phase: 'pending_binary',
      upload: null,
      attempts: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastError: '',
    };

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([queuedItem]));

    const result = await drainProjectUploadQueue({ userId: 'user-1', projectId: 'project-1', reason: 'test' });

    expect(result.processed).toBe(1);
    expect(updateProjectSecure).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        uploadSignals: expect.arrayContaining([
          expect.objectContaining({ id: 'uploading_1', status: 'uploading' }),
        ]),
      }),
    );
    expect(addProjectFileSecure).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        name: 'demo.jpg',
        storageProvider: 'r2',
      }),
    );
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///documents/project-upload-queue/upl_1.jpg', { idempotent: true });
  });

  it('marks signal as failed when commit fails', async () => {
    const queuedItem = {
      id: 'upl_2',
      signalId: 'uploading_2',
      userId: 'user-1',
      projectId: 'project-1',
      localUri: 'file:///documents/project-upload-queue/upl_2.jpg',
      name: 'demo-2.jpg',
      mimeType: 'image/jpeg',
      contentType: 'image/jpeg',
      size: 2048,
      folderId: null,
      phase: 'pending_binary',
      upload: null,
      attempts: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastError: '',
    };

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([queuedItem]));
    (addProjectFileSecure as jest.Mock).mockResolvedValue({ success: false, message: 'commit failed' });

    const result = await drainProjectUploadQueue({ userId: 'user-1', projectId: 'project-1', reason: 'test-fail' });

    expect(result.processed).toBe(0);
    expect(updateProjectSecure).toHaveBeenLastCalledWith(
      'project-1',
      expect.objectContaining({
        uploadSignals: expect.arrayContaining([
          expect.objectContaining({ id: 'uploading_2', status: 'failed' }),
        ]),
      }),
    );
  });
});
