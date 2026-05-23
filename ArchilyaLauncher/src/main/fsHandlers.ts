import { ipcMain, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import fileWatcherService from './services/fileWatcherService';

// ════════════════════════════════════════════════════════════
// DOSYA SİSTEMİ IPC HANDLER'LARI — Main Process
// ════════════════════════════════════════════════════════════

export function registerFsHandlers(win: BrowserWindow): void {
  fileWatcherService.setWindow(win);

  ipcMain.handle('fs:list', async (_event, directoryPath: string) => {
    try {
      return await fileWatcherService.listDirectory(directoryPath);
    } catch (err: any) {
      console.error('[fs:list] Hata:', err);
      return { success: false, items: [], error: err.message || 'Klasör listelenemedi.' };
    }
  });

  ipcMain.handle('fs:watch', async (_event, directoryPath: string, projectId?: string) => {
    try {
      return await fileWatcherService.startWatching(directoryPath, projectId);
    } catch (err: any) {
      console.error('[fs:watch] Hata:', err);
      return { success: false, error: err.message || 'İzleme başlatılamadı.' };
    }
  });

  ipcMain.handle('fs:unwatch', async (event, directoryPath: string) => {
    try {
      if (event.sender.isDestroyed()) {
        return { success: false };
      }
      return await fileWatcherService.stopWatching(directoryPath);
    } catch (err: any) {
      console.error('[fs:unwatch] Hata:', err);
      return { success: false };
    }
  });

  // FAZ 2.4: Dosya açma — shell.openPath ile varsayılan program
  ipcMain.handle('fs:openFile', async (_event, filePath: string) => {
    try {
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes('..')) {
        return { success: false, error: 'Gecersiz dosya yolu.' };
      }
      if (!fs.existsSync(normalizedPath)) {
        return { success: false, error: 'Dosya bulunamadi.' };
      }
      const result = await shell.openPath(normalizedPath);
      // shell.openPath boş string dönerse başarılı, hata mesajı dönerse başarısız
      if (result && result.trim() !== '') {
        console.error(`[fs:openFile] Hata: ${result}`);
        return { success: false, error: `Dosya açılamadı: ${result}` };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[fs:openFile] Hata:', err);
      return { success: false, error: err.message || 'Dosya açılamadı.' };
    }
  });

  // FAZ 2.4: Dosya kopyalama — sürükle-bırak / seçim ile proje klasörüne
  ipcMain.handle('fs:copyFiles', async (_event, destDir: string, filePaths: string[]) => {
    try {
      await fs.promises.mkdir(destDir, { recursive: true });
      const results = await Promise.all(
        filePaths.map(async (srcPath) => {
          const fileName = path.basename(srcPath);
          const destPath = path.join(destDir, fileName);
          await fs.promises.copyFile(srcPath, destPath);
          return fileName;
        })
      );
      return { success: true, copied: results };
    } catch (err: any) {
      console.error('[fs:copyFiles] Hata:', err);
      return { success: false, error: err.message || 'Dosyalar kopyalanamadı.' };
    }
  });
}

export function removeFsHandlers(): void {
  ipcMain.removeHandler('fs:list');
  ipcMain.removeHandler('fs:watch');
  ipcMain.removeHandler('fs:unwatch');
  ipcMain.removeHandler('fs:openFile');
  ipcMain.removeHandler('fs:copyFiles');
  void fileWatcherService.shutdown();
}
