"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVersionHandlers = registerVersionHandlers;
exports.removeVersionHandlers = removeVersionHandlers;
const electron_1 = require("electron");
const versionService_1 = require("./services/versionService");
// ════════════════════════════════════════════════════════════
// VERSİYON IPC HANDLER'LARI — Main Process
// ════════════════════════════════════════════════════════════
function registerVersionHandlers(_win) {
    electron_1.ipcMain.handle('version:list', async (_event, projectId, fileId) => {
        try {
            return await (0, versionService_1.getFileVersions)(projectId, fileId);
        }
        catch (err) {
            console.error('[version:list] Hata:', err);
            return { success: false, versions: [], error: err.message || 'Versiyonlar listelenemedi.' };
        }
    });
    electron_1.ipcMain.handle('version:restore', async (_event, projectId, versionId, localDirPath) => {
        try {
            return await (0, versionService_1.restoreFileVersion)(projectId, versionId, localDirPath);
        }
        catch (err) {
            console.error('[version:restore] Hata:', err);
            return { success: false, error: err.message || 'Versiyon geri yüklenemedi.' };
        }
    });
    electron_1.ipcMain.handle('version:note', async (_event, request) => {
        try {
            return await (0, versionService_1.updateVersionNote)(request.projectId, request.versionId, request.changeNote);
        }
        catch (err) {
            console.error('[version:note] Hata:', err);
            return { success: false, error: err.message || 'Not güncellenemedi.' };
        }
    });
}
function removeVersionHandlers() {
    electron_1.ipcMain.removeHandler('version:list');
    electron_1.ipcMain.removeHandler('version:restore');
    electron_1.ipcMain.removeHandler('version:note');
}
