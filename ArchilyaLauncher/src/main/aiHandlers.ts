import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import type { AiGenerateRequest } from '../shared/aiTypes';
import aiService from './services/aiService';

// ════════════════════════════════════════════════════════════
// AI IPC HANDLER'LARI — Main Process
// ════════════════════════════════════════════════════════════

export function registerAiHandlers(win: BrowserWindow): void {
  aiService.setWindow(win);

  ipcMain.handle('ai:generate', async (_event, request: AiGenerateRequest) => {
    try {
      return await aiService.createJob(request);
    } catch (err: any) {
      console.error('[ai:generate] Hata:', err);
      return {
        success: false,
        error: err.message || 'AI işlemi başlatılamadı.',
      };
    }
  });

  ipcMain.handle('ai:status', async (_event, jobId: string) => {
    try {
      return aiService.getJobStatus(jobId);
    } catch (err: any) {
      console.error('[ai:status] Hata:', err);
      return {
        jobId,
        status: 'failed',
        progress: 0,
        error: err.message || 'Durum sorgulanamadı.',
      };
    }
  });

  ipcMain.handle('ai:cancel', async (_event, jobId: string) => {
    try {
      return aiService.cancelJob(jobId);
    } catch (err: any) {
      console.error('[ai:cancel] Hata:', err);
      return { success: false };
    }
  });
}

export function removeAiHandlers(): void {
  ipcMain.removeHandler('ai:generate');
  ipcMain.removeHandler('ai:status');
  ipcMain.removeHandler('ai:cancel');
  aiService.shutdown();
}
