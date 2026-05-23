import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { storage, db, auth } from '../firebase';
import type { BrowserWindow } from 'electron';

import { createR2UploadUrlSecure, shouldUseR2Upload, uploadFilePathToSignedUrl } from './r2UploadService';
import { clearProjectUploadSignal, upsertProjectUploadSignal } from './uploadSignalService';
import { saveFileVersion } from './versionService';
import log from 'electron-log';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getFileType(filePath: string): string {
  return path.extname(filePath).replace('.', '').toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getContentType(fileType: string): string {
  if (fileType === 'pdf') return 'application/pdf';
  if (['dwg', 'dxf'].includes(fileType)) return 'application/octet-stream';
  return `image/${fileType === 'jpg' ? 'jpeg' : fileType || 'jpeg'}`;
}

function getTypeKey(fileType: string): 'pdf' | 'dwg' | 'img' {
  if (fileType === 'pdf') return 'pdf';
  if (['dwg', 'dxf'].includes(fileType)) return 'dwg';
  return 'img';
}

export async function uploadFileToProject(
  localFilePath: string,
  projectId: string,
  win: BrowserWindow,
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' };

  const fileName = path.basename(localFilePath);
  const fileType = getFileType(localFilePath);
  const fileStats = fs.statSync(localFilePath);
  const fileSize = fileStats.size;
  const contentType = getContentType(fileType);
  const signalId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const useR2 = shouldUseR2Upload({ fileName, fileSize, contentType });

  await upsertProjectUploadSignal({
    id: signalId,
    userId: user.uid,
    projectId,
    name: fileName,
    size: fileSize,
    contentType,
    folderId: null,
    storageProvider: useR2 ? 'r2' : 'firebase',
    status: 'uploading',
  }).catch(() => null);

  if (useR2) {
    try {
      const uploadMeta = await createR2UploadUrlSecure({
        projectId,
        fileName,
        fileSize,
        contentType,
      });

      if (!uploadMeta?.success || !uploadMeta?.uploadUrl || !uploadMeta?.objectKey) {
        throw new Error('R2 upload URL olusturulamadi.');
      }

      await uploadFilePathToSignedUrl(uploadMeta.uploadUrl, localFilePath, contentType, uploadMeta.pseudoUrl);

      const downloadUrl = String(uploadMeta.pseudoUrl || `r2://${uploadMeta.objectKey}`).trim();
      await updateDoc(doc(db, 'projects', projectId), {
        files: arrayUnion({
          name: fileName,
          url: downloadUrl,
          path: null,
          size: fileSize,
          type: fileType,
          storageProvider: 'r2',
          objectKey: String(uploadMeta.objectKey || '').trim() || null,
          contentType,
          folderId: null,
          createdAt: new Date().toISOString(),
          uploadedBy: user.displayName || user.email || undefined,
          status: 'active',
        }),
        [`fileCount.${getTypeKey(fileType)}`]: increment(1),
        totalSize: increment(fileSize),
        activityLog: arrayUnion({
          action: 'file_upload',
          user: user.displayName || user.email,
          timestamp: new Date().toISOString(),
          details: `${fileName} yüklendi (${formatBytes(fileSize)}) — Launcher`,
        }),
        updatedAt: serverTimestamp(),
      });

      // FAZ 2.5: Versiyon kaydı oluştur
      const uploadedFile = {
        name: fileName,
        url: downloadUrl,
        path: null,
        size: fileSize,
        type: fileType,
        storageProvider: 'r2' as const,
        objectKey: String(uploadMeta.objectKey || '').trim() || null,
        contentType,
        folderId: null,
        createdAt: new Date().toISOString(),
        uploadedBy: user.displayName || user.email || undefined,
        status: 'active' as const,
      };
      void saveFileVersion(projectId, uploadedFile);

      await clearProjectUploadSignal(projectId, signalId).catch(() => null);
      win.webContents.send('upload-complete', { fileName, projectId, downloadUrl });
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'R2 yukleme hatasi');
      await upsertProjectUploadSignal({
        id: signalId,
        userId: user.uid,
        projectId,
        name: fileName,
        size: fileSize,
        contentType,
        folderId: null,
        storageProvider: 'r2',
        status: 'failed',
        lastError: errorMessage,
      }).catch(() => null);
      win.webContents.send('upload-error', { fileName, projectId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  const storagePath = `users/${user.uid}/projects/${projectId}/${Date.now()}_${fileName}`;
  const sRef = storageRef(storage, storagePath);
  const fileBuffer = fs.readFileSync(localFilePath);
  const fileBlob = new Uint8Array(fileBuffer);

  return new Promise((resolve) => {
    const uploadTask = uploadBytesResumable(sRef, fileBlob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        win.webContents.send('upload-progress', { fileName, projectId, percent });
      },
      (error) => {
        void upsertProjectUploadSignal({
          id: signalId,
          userId: user.uid,
          projectId,
          name: fileName,
          size: fileSize,
          contentType,
          folderId: null,
          storageProvider: 'firebase',
          status: 'failed',
          lastError: error.message,
        }).catch(() => null);
        win.webContents.send('upload-error', { fileName, projectId, error: error.message });
        resolve({ success: false, error: error.message });
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, 'projects', projectId), {
            files: arrayUnion({
              name: fileName,
              url: downloadUrl,
              path: storagePath,
              size: fileSize,
              type: fileType,
              storageProvider: 'firebase',
              objectKey: null,
              contentType,
              folderId: null,
              createdAt: new Date().toISOString(),
              uploadedBy: user.displayName || user.email || undefined,
              status: 'active',
            }),
            [`fileCount.${getTypeKey(fileType)}`]: increment(1),
            totalSize: increment(fileSize),
            activityLog: arrayUnion({
              action: 'file_upload',
              user: user.displayName || user.email,
              timestamp: new Date().toISOString(),
              details: `${fileName} yüklendi (${formatBytes(fileSize)}) — Launcher`,
            }),
            updatedAt: serverTimestamp(),
          });

          // FAZ 2.5: Versiyon kaydı oluştur
          const uploadedFile = {
            name: fileName,
            url: downloadUrl,
            path: storagePath,
            size: fileSize,
            type: fileType,
            storageProvider: 'firebase' as const,
            objectKey: null,
            contentType,
            folderId: null,
            createdAt: new Date().toISOString(),
            uploadedBy: user.displayName || user.email || undefined,
            status: 'active' as const,
          };
          void saveFileVersion(projectId, uploadedFile);

          await clearProjectUploadSignal(projectId, signalId).catch(() => null);
          win.webContents.send('upload-complete', { fileName, projectId, downloadUrl });
          resolve({ success: true });
        } catch (err: unknown) {
          log.error('Yükleme sonrası hata:', err);
          resolve({ success: false, error: getErrorMessage(err, 'Yükleme tamamlandı ama kayıt hatası') });
        }
      }
    );
  });
}

export async function deleteFileFromProject(
  projectId: string,
  file: {
    name: string;
    url: string;
    path: string | null;
    size: number;
    type: string;
    createdAt: string;
    folderId: string | null;
    uploadedBy?: string;
    status?: 'active' | 'trashed';
    deletedAt?: string | null;
    deletedBy?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' };

  try {
    const typeKey =
      file.type === 'pdf'
        ? 'pdf'
        : ['dwg', 'dxf'].includes(file.type)
          ? 'dwg'
          : 'img';

    const trashedFile = {
      ...file,
      status: 'trashed' as const,
      deletedAt: new Date().toISOString(),
      deletedBy: user.displayName || user.email || user.uid,
    };

    await updateDoc(doc(db, 'projects', projectId), {
      files: arrayRemove(file),
      deletedFiles: arrayUnion(trashedFile),
      [`fileCount.${typeKey}`]: increment(-1),
      totalSize: increment(-(file.size || 0)),
      activityLog: arrayUnion({
        action: 'file_delete',
        user: user.displayName || user.email,
        timestamp: new Date().toISOString(),
        details: `${file.name} cop kutusuna tasindi (soft delete, Launcher)`,
      }),
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, 'Dosya silinemedi.') };
  }
}
