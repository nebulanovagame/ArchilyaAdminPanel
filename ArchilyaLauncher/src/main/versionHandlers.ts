import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import type { VersionNoteRequest } from '../shared/versionTypes';
import {
  getFileVersions,
  restoreFileVersion,
  updateVersionNote,
} from './services/versionService';

// ════════════════════════════════════════════════════════════
// VERSİYON IPC HANDLER'LARI — Main Process
// ════════════════════════════════════════════════════════════

export function registerVersionHandlers(_win: BrowserWindow): void {
  ipcMain.handle('version:list', async (_event, projectId: string, fileId: string) => {
    try {
      return await getFileVersions(projectId, fileId);
    } catch (err: any) {
      console.error('[version:list] Hata:', err);
      return { success: false, versions: [], error: err.message || 'Versiyonlar listelenemedi.' };
    }
  });

  ipcMain.handle('version:restore', async (_event, projectId: string, versionId: string, localDirPath?: string) => {
    try {
      return await restoreFileVersion(projectId, versionId, localDirPath);
    } catch (err: any) {
      console.error('[version:restore] Hata:', err);
      return { success: false, error: err.message || 'Versiyon geri yüklenemedi.' };
    }
  });

  ipcMain.handle('version:note', async (_event, request: VersionNoteRequest) => {
    try {
      return await updateVersionNote(request.projectId, request.versionId, request.changeNote);
    } catch (err: any) {
      console.error('[version:note] Hata:', err);
      return { success: false, error: err.message || 'Not güncellenemedi.' };
    }
  });
}

export function removeVersionHandlers(): void {
  ipcMain.removeHandler('version:list');
  ipcMain.removeHandler('version:restore');
  ipcMain.removeHandler('version:note');
}
