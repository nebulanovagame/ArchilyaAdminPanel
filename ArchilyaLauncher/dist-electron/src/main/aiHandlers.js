"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAiHandlers = registerAiHandlers;
exports.removeAiHandlers = removeAiHandlers;
const electron_1 = require("electron");
const aiService_1 = __importDefault(require("./services/aiService"));
// ════════════════════════════════════════════════════════════
// AI IPC HANDLER'LARI — Main Process
// ════════════════════════════════════════════════════════════
function registerAiHandlers(win) {
    aiService_1.default.setWindow(win);
    electron_1.ipcMain.handle('ai:generate', async (_event, request) => {
        try {
            return await aiService_1.default.createJob(request);
        }
        catch (err) {
            console.error('[ai:generate] Hata:', err);
            return {
                success: false,
                error: err.message || 'AI işlemi başlatılamadı.',
            };
        }
    });
    electron_1.ipcMain.handle('ai:status', async (_event, jobId) => {
        try {
            return aiService_1.default.getJobStatus(jobId);
        }
        catch (err) {
            console.error('[ai:status] Hata:', err);
            return {
                jobId,
                status: 'failed',
                progress: 0,
                error: err.message || 'Durum sorgulanamadı.',
            };
        }
    });
    electron_1.ipcMain.handle('ai:cancel', async (_event, jobId) => {
        try {
            return aiService_1.default.cancelJob(jobId);
        }
        catch (err) {
            console.error('[ai:cancel] Hata:', err);
            return { success: false };
        }
    });
}
function removeAiHandlers() {
    electron_1.ipcMain.removeHandler('ai:generate');
    electron_1.ipcMain.removeHandler('ai:status');
    electron_1.ipcMain.removeHandler('ai:cancel');
    aiService_1.default.shutdown();
}
