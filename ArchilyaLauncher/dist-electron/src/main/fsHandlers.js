"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFsHandlers = registerFsHandlers;
exports.removeFsHandlers = removeFsHandlers;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fileWatcherService_1 = __importDefault(require("./services/fileWatcherService"));
// ════════════════════════════════════════════════════════════
// DOSYA SİSTEMİ IPC HANDLER'LARI — Main Process
// ════════════════════════════════════════════════════════════
function registerFsHandlers(win) {
    fileWatcherService_1.default.setWindow(win);
    electron_1.ipcMain.handle('fs:list', async (_event, directoryPath) => {
        try {
            return await fileWatcherService_1.default.listDirectory(directoryPath);
        }
        catch (err) {
            console.error('[fs:list] Hata:', err);
            return { success: false, items: [], error: err.message || 'Klasör listelenemedi.' };
        }
    });
    electron_1.ipcMain.handle('fs:watch', async (_event, directoryPath, projectId) => {
        try {
            return await fileWatcherService_1.default.startWatching(directoryPath, projectId);
        }
        catch (err) {
            console.error('[fs:watch] Hata:', err);
            return { success: false, error: err.message || 'İzleme başlatılamadı.' };
        }
    });
    electron_1.ipcMain.handle('fs:unwatch', async (event, directoryPath) => {
        try {
            if (event.sender.isDestroyed()) {
                return { success: false };
            }
            return await fileWatcherService_1.default.stopWatching(directoryPath);
        }
        catch (err) {
            console.error('[fs:unwatch] Hata:', err);
            return { success: false };
        }
    });
    // FAZ 2.4: Dosya açma — shell.openPath ile varsayılan program
    electron_1.ipcMain.handle('fs:openFile', async (_event, filePath) => {
        try {
            const normalizedPath = path_1.default.normalize(filePath);
            if (normalizedPath.includes('..')) {
                return { success: false, error: 'Gecersiz dosya yolu.' };
            }
            if (!fs_1.default.existsSync(normalizedPath)) {
                return { success: false, error: 'Dosya bulunamadi.' };
            }
            const result = await electron_1.shell.openPath(normalizedPath);
            // shell.openPath boş string dönerse başarılı, hata mesajı dönerse başarısız
            if (result && result.trim() !== '') {
                console.error(`[fs:openFile] Hata: ${result}`);
                return { success: false, error: `Dosya açılamadı: ${result}` };
            }
            return { success: true };
        }
        catch (err) {
            console.error('[fs:openFile] Hata:', err);
            return { success: false, error: err.message || 'Dosya açılamadı.' };
        }
    });
    // FAZ 2.4: Dosya kopyalama — sürükle-bırak / seçim ile proje klasörüne
    electron_1.ipcMain.handle('fs:copyFiles', async (_event, destDir, filePaths) => {
        try {
            await fs_1.default.promises.mkdir(destDir, { recursive: true });
            const results = await Promise.all(filePaths.map(async (srcPath) => {
                const fileName = path_1.default.basename(srcPath);
                const destPath = path_1.default.join(destDir, fileName);
                await fs_1.default.promises.copyFile(srcPath, destPath);
                return fileName;
            }));
            return { success: true, copied: results };
        }
        catch (err) {
            console.error('[fs:copyFiles] Hata:', err);
            return { success: false, error: err.message || 'Dosyalar kopyalanamadı.' };
        }
    });
}
function removeFsHandlers() {
    electron_1.ipcMain.removeHandler('fs:list');
    electron_1.ipcMain.removeHandler('fs:watch');
    electron_1.ipcMain.removeHandler('fs:unwatch');
    electron_1.ipcMain.removeHandler('fs:openFile');
    electron_1.ipcMain.removeHandler('fs:copyFiles');
    void fileWatcherService_1.default.shutdown();
}
