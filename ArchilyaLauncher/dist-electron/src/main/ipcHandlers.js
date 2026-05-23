"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupUnauthorizedPaks = cleanupUnauthorizedPaks;
exports.registerIpcHandlers = registerIpcHandlers;
exports.removeIpcHandlers = removeIpcHandlers;
exports.shutdownStreamingInfrastructure = shutdownStreamingInfrastructure;
exports.startWebShareFromCore = startWebShareFromCore;
exports.stopWebShareFromCore = stopWebShareFromCore;
exports.getWebShareStatusFromCore = getWebShareStatusFromCore;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const firebase_1 = require("./firebase"); // auth import et
const aiHandlers_1 = require("./aiHandlers");
const fsHandlers_1 = require("./fsHandlers");
const versionHandlers_1 = require("./versionHandlers");
const gameService_1 = require("./services/gameService");
const launchProfileService_1 = require("./services/launchProfileService");
const archilyaProcessService_1 = require("./services/archilyaProcessService");
const streamingOrchestrator_1 = require("./services/streamingOrchestrator");
const authService_1 = require("./services/authService");
const projectService_1 = require("./services/projectService");
const storageService_1 = require("./services/storageService");
const settingsStore_1 = require("./services/settingsStore");
const vrProjectService = __importStar(require("./services/vrProjectService"));
const syncService_1 = require("./services/syncService");
const electron_log_1 = __importDefault(require("electron-log"));
// ── Sabitler ─────────────────────────────────────────────────────────────────
const GAME_INSTALL_PATH = path_1.default.join(electron_1.app.getPath('userData'), 'Archilya');
const PAKS_PATH = path_1.default.join(GAME_INSTALL_PATH, 'Archilya', 'Content', 'Paks');
const GAME_EXE_NAME = 'Archilya.exe';
function resolveSignallingScriptPath() {
    const envPath = process.env.ARCHILYA_SIGNAL_SCRIPT_PATH;
    if (envPath && fs_1.default.existsSync(envPath)) {
        return envPath;
    }
    const candidates = electron_1.app.isPackaged
        ? [
            path_1.default.join(process.resourcesPath, 'SignallingWebServer', 'dist', 'index.js'),
            path_1.default.join(path_1.default.dirname(process.execPath), 'SignallingWebServer', 'dist', 'index.js'),
            path_1.default.join(process.cwd(), 'SignallingWebServer', 'dist', 'index.js'),
        ]
        : [
            path_1.default.join(process.cwd(), 'SignallingWebServer', 'dist', 'index.js'),
            path_1.default.join(electron_1.app.getAppPath(), 'SignallingWebServer', 'dist', 'index.js'),
            path_1.default.join(path_1.default.dirname(electron_1.app.getAppPath()), 'SignallingWebServer', 'dist', 'index.js'),
        ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return envPath || candidates[0];
}
function getErrorMessage(err, fallback) {
    return err instanceof Error && err.message ? err.message : fallback;
}
async function getLaunchAuthContext() {
    const user = firebase_1.auth.currentUser;
    if (!user) {
        return null;
    }
    return {
        uid: user.uid,
        token: await user.getIdToken(false),
        displayName: user.displayName || user.email?.split('@')[0] || 'ArchilyaUser',
        isGuest: user.isAnonymous,
        isVerified: user.emailVerified,
    };
}
async function launchArchilyaWithProfile(exePath, request) {
    if (!fs_1.default.existsSync(exePath)) {
        return { success: false, message: 'Archilya dosyası bulunamadı. Lütfen önce Archilya kurulumunu tamamlayın.' };
    }
    if ((0, gameService_1.isGameRunning)()) {
        return { success: false, message: 'Archilya zaten çalışıyor.' };
    }
    const authContext = await getLaunchAuthContext();
    if (!authContext) {
        return { success: false, message: 'Archilya başlatmak için giriş yapmanız gerekiyor.' };
    }
    let profile;
    switch (request.mode) {
        case 'standard':
            profile = (0, launchProfileService_1.createStandardLaunchProfile)();
            break;
        case 'vr-project':
            profile = (0, launchProfileService_1.createVrProjectLaunchProfile)(request.mapName || '');
            break;
        case 'pixel-streaming':
            {
                const startResult = await getStreamingOrchestrator().start({
                    mapName: request.mapName,
                    streamerPort: request.pixelStreaming?.port,
                }, authContext);
                return {
                    success: startResult.success,
                    message: startResult.message,
                };
            }
        default:
            return { success: false, message: 'Desteklenmeyen başlatma modu.' };
    }
    try {
        const args = (0, launchProfileService_1.buildLaunchArgs)(profile, authContext);
        electron_log_1.default.info(`[archilya:launch] mode=${request.mode} map=${request.mapName || '-'} args=${args.join(' ')}`);
        const proc = (0, archilyaProcessService_1.startArchilyaProcess)(exePath, args);
        (0, gameService_1.setGameProcess)(proc);
        proc.unref();
        return { success: true };
    }
    catch (err) {
        return { success: false, message: err.message || 'Archilya başlatılamadı.' };
    }
}
// ── State ─────────────────────────────────────────────────────────────────────
let projectsUnsubscribe = null;
// Proje başına aktif indirme kaynağı (iptal için)
const activeDownloads = new Map();
let syncService = null;
let streamingOrchestrator = null;
function getStreamingOrchestrator() {
    if (!streamingOrchestrator) {
        streamingOrchestrator = new streamingOrchestrator_1.StreamingOrchestrator({
            signalling: {
                scriptPath: resolveSignallingScriptPath(),
                playerPort: 8080,
                streamerPort: 8888,
                nodeExecutable: process.env.ARCHILYA_NODE_PATH,
            },
            archilyaExecutablePath: path_1.default.join(GAME_INSTALL_PATH, GAME_EXE_NAME),
        });
    }
    return streamingOrchestrator;
}
// ════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR — PAK SİSTEMİ
// ════════════════════════════════════════════════════════════════════════════
// Her proje için kendi klasörünü Paks altında oluştur
function getPakDir(projectId) {
    const dir = path_1.default.join(PAKS_PATH, projectId);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
// Kurulu versiyon bilgisini oku (.pak-version dosyasından)
function readInstalledVersion(projectId) {
    const versionFile = path_1.default.join(getPakDir(projectId), '.pak-version');
    if (!fs_1.default.existsSync(versionFile))
        return null;
    try {
        return fs_1.default.readFileSync(versionFile, 'utf-8').trim();
    }
    catch {
        return null;
    }
}
// Versiyonu diske yaz
function writeInstalledVersion(projectId, version) {
    fs_1.default.writeFileSync(path_1.default.join(getPakDir(projectId), '.pak-version'), version, 'utf-8');
}
// Tüm PAK dosyaları diske kurulu mu kontrol et
function arePaksInstalled(projectId, pakFiles) {
    if (!pakFiles || pakFiles.length === 0)
        return false;
    const dir = getPakDir(projectId);
    return pakFiles.every(f => fs_1.default.existsSync(path_1.default.join(dir, f.name)));
}
// MD5 hash hesapla
function calcMd5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto_1.default.createHash('md5');
        const stream = fs_1.default.createReadStream(filePath);
        stream.on('data', d => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex').toUpperCase()));
        stream.on('error', reject);
    });
}
// ── FIX 1: %100'de takılma çözümü ──────────────────────────────────────────
// Promise'i pipe'dan ÖNCE kur: böylece küçük/hızlı dosyalarda bile
// 'close' eventini kaçırmayız. stream.pipeline kullanarak hem pipe hem
// hata yayılımı güvenli hale getirildi.
function pipeAndWait(source, writer, cancelToken) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (err) => {
            if (settled)
                return;
            settled = true;
            err ? reject(err) : resolve();
        };
        // Listener'ları pipe'dan ÖNCE kaydet
        writer.on('finish', () => done());
        writer.on('error', (err) => done(err));
        source.on('error', (err) => { writer.destroy(); done(err); });
        cancelToken.promise.then(() => {
            source.destroy?.();
            writer.destroy();
            done(new Error('İndirme iptal edildi.'));
        });
        // Şimdi pipe et
        source.pipe(writer);
    });
}
// ── FIX 2: Kilitli dosyaları da silebilen güvenilir silme ──────────────────
async function safeRmDir(dir) {
    if (!fs_1.default.existsSync(dir))
        return;
    // Windows'ta kilitli dosyalar için birkaç deneme yap
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await fs_1.default.promises.rm(dir, { recursive: true, force: true });
            return;
        }
        catch (err) {
            lastErr = err;
            // 300ms bekle ve tekrar dene
            await new Promise(r => setTimeout(r, 300));
        }
    }
    throw lastErr;
}
// ════════════════════════════════════════════════════════════════════════════
// VR Projeleri için Paks klasörü temizleme (kullanıcı değişince)
// Sadece o kullanıcıya ait olmayan klasörleri siler.
// ════════════════════════════════════════════════════════════════════════════
async function cleanupUnauthorizedPaks(authorizedProjectIds) {
    if (!fs_1.default.existsSync(PAKS_PATH))
        return;
    try {
        const entries = await fs_1.default.promises.readdir(PAKS_PATH, { withFileTypes: true });
        const authorizedSet = new Set(authorizedProjectIds);
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (!authorizedSet.has(entry.name)) {
                const dirToRemove = path_1.default.join(PAKS_PATH, entry.name);
                try {
                    await safeRmDir(dirToRemove);
                    electron_log_1.default.info(`[cleanup] Yetkisiz klasör silindi: ${entry.name}`);
                }
                catch (err) {
                    electron_log_1.default.warn(`[cleanup] Silinemedi: ${entry.name}`, err);
                }
            }
        }
    }
    catch (err) {
        electron_log_1.default.error('[cleanup] cleanupUnauthorizedPaks error:', err);
    }
}
// ════════════════════════════════════════════════════════════════════════════
// registerIpcHandlers
// ════════════════════════════════════════════════════════════════════════════
function registerIpcHandlers(win) {
    if (!syncService) {
        syncService = new syncService_1.SyncService(win);
    }
    // ── AI Motor (FAZ 2.1) ──────────────────────────────────────────────────
    (0, aiHandlers_1.registerAiHandlers)(win);
    // ── Dosya Sistemi (FAZ 2.2) ─────────────────────────────────────────────
    (0, fsHandlers_1.registerFsHandlers)(win);
    // ── Versiyon Yönetimi (FAZ 2.5) ─────────────────────────────────────────
    (0, versionHandlers_1.registerVersionHandlers)(win);
    // ── Auth Yönetimi (Firebase SDK) ────────────────────────────────────────
    electron_1.ipcMain.handle('auth:login', async (_e, email, password, rememberMe) => {
        return await (0, authService_1.loginWithEmail)(email, password, rememberMe);
    });
    electron_1.ipcMain.handle('auth:loginWithGoogle', async (_e, rememberMe) => {
        return await (0, authService_1.loginWithGoogle)(rememberMe);
    });
    electron_1.ipcMain.handle('auth:register', async (_e, email, password) => {
        return await (0, authService_1.registerWithEmail)(email, password);
    });
    electron_1.ipcMain.handle('auth:resetPassword', async (_e, email) => {
        return await (0, authService_1.resetPassword)(email);
    });
    electron_1.ipcMain.handle('auth:loginGuest', async () => {
        return await (0, authService_1.loginGuest)();
    });
    electron_1.ipcMain.handle('auth:checkSession', async () => {
        return await (0, authService_1.checkSession)();
    });
    // auth:logout main.ts'te tutulur (project watcher durdurma için)
    electron_1.ipcMain.handle('auth:getSavedEmail', async () => {
        return (0, authService_1.getSavedEmail)();
    });
    // ── Ayarlar ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('settings:get', async () => {
        try {
            return { success: true, settings: (0, settingsStore_1.getSettings)() };
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Ayarlar okunamadı.') };
        }
    });
    electron_1.ipcMain.handle('settings:update', async (_e, settings) => {
        try {
            return { success: true, settings: (0, settingsStore_1.updateSettings)(settings) };
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Ayarlar güncellenemedi.') };
        }
    });
    // ── Firebase Proje Yönetimi ─────────────────────────────────────────────
    electron_1.ipcMain.handle('projects:subscribe', async () => {
        try {
            const user = firebase_1.auth.currentUser;
            if (!user) {
                return { success: false, error: 'Oturum açmanız gerekiyor.' };
            }
            if (projectsUnsubscribe) {
                projectsUnsubscribe();
                projectsUnsubscribe = null;
            }
            projectsUnsubscribe = (0, projectService_1.subscribeToProjects)(user.uid, (projects) => {
                if (!win.isDestroyed()) {
                    win.webContents.send('projects:changed', projects);
                }
            }, (err) => {
                const message = err.message || 'Projeler dinlenirken hata oluştu.';
                if (!win.isDestroyed()) {
                    win.webContents.send('projects:error', message);
                }
            });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Proje aboneliği başlatılamadı.') };
        }
    });
    electron_1.ipcMain.handle('projects:unsubscribe', async () => {
        try {
            if (projectsUnsubscribe) {
                projectsUnsubscribe();
                projectsUnsubscribe = null;
            }
            return { success: true };
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Proje aboneliği durdurulamadı.') };
        }
    });
    electron_1.ipcMain.handle('projects:add', async (_e, data) => {
        try {
            return await (0, projectService_1.addProject)(data);
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Proje oluşturulamadı.') };
        }
    });
    electron_1.ipcMain.handle('projects:update', async (_e, id, data) => {
        try {
            return await (0, projectService_1.updateProject)(id, data);
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Proje güncellenemedi.') };
        }
    });
    electron_1.ipcMain.handle('projects:delete', async (_e, id) => {
        try {
            return await (0, projectService_1.deleteProject)(id);
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Proje silinemedi.') };
        }
    });
    // ── Dosya Yönetimi ──────────────────────────────────────────────────────
    electron_1.ipcMain.handle('files:upload', async (_e, projectId) => {
        try {
            const result = await electron_1.dialog.showOpenDialog(win, {
                properties: ['openFile', 'multiSelections'],
            });
            if (result.canceled) {
                return { success: false, canceled: true };
            }
            const selectedPaths = result.filePaths;
            for (const filePath of selectedPaths) {
                const uploadResult = await (0, storageService_1.uploadFileToProject)(filePath, projectId, win);
                if (!uploadResult.success) {
                    return { success: false, error: uploadResult.error || 'Dosya yüklenemedi.' };
                }
            }
            return { success: true, count: selectedPaths.length };
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Dosya yüklenemedi.') };
        }
    });
    electron_1.ipcMain.handle('files:delete', async (_e, projectId, file) => {
        return await (0, storageService_1.deleteFileFromProject)(projectId, file);
    });
    // ── Dosya Senkronizasyonu ────────────────────────────────────────────────
    electron_1.ipcMain.handle('sync:getLocalProjectPath', async (_e, projectId) => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        return syncService.getLocalProjectPath(projectId);
    });
    electron_1.ipcMain.handle('sync:project', async (_e, projectId) => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        await syncService.syncProject(projectId);
    });
    electron_1.ipcMain.handle('sync:all', async () => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        await syncService.syncAllProjects();
    });
    electron_1.ipcMain.handle('sync:getStatus', async (_e, projectId) => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        return syncService.getStatus(projectId);
    });
    electron_1.ipcMain.handle('sync:openProjectFolder', async (_e, projectId) => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        await syncService.openProjectFolder(projectId);
    });
    electron_1.ipcMain.handle('sync:setFolder', async () => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        const result = await electron_1.dialog.showOpenDialog(win, {
            title: 'Senkronizasyon klasoru sec',
            properties: ['openDirectory', 'createDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return syncService.getSyncRoot();
        }
        return syncService.setSyncRoot(result.filePaths[0]);
    });
    electron_1.ipcMain.handle('sync:notifyOnline', async () => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        await syncService.handleNetworkOnline();
    });
    electron_1.ipcMain.handle('sync:notifyFocus', async () => {
        if (!syncService)
            throw new Error('Sync servisi hazir degil.');
        await syncService.handleAppFocus();
    });
    // ══════════════════════════════════════════════════════════════════════════
    // PAK / VR BUILD SİSTEMİ — SADECE LAUNCHER
    // ══════════════════════════════════════════════════════════════════════════
    // 1. PAK durumunu kontrol et (kurulu mu, güncel mi?)
    electron_1.ipcMain.handle('pak:checkStatus', (_e, projectId, pakFiles, currentVersion) => {
        if (!pakFiles || pakFiles.length === 0) {
            return { status: 'not-installed', installedVersion: null, latestVersion: currentVersion || null };
        }
        const installedVersion = readInstalledVersion(projectId);
        const installed = arePaksInstalled(projectId, pakFiles);
        if (!installed || !installedVersion) {
            return { status: 'not-installed', installedVersion: null, latestVersion: currentVersion };
        }
        if (currentVersion && installedVersion !== currentVersion) {
            return { status: 'update-available', installedVersion, latestVersion: currentVersion };
        }
        return { status: 'installed', installedVersion, latestVersion: currentVersion };
    });
    // 2. PAK dosyalarını indir
    electron_1.ipcMain.handle('pak:download', async (_e, projectId, pakFiles) => {
        if (!pakFiles || pakFiles.length === 0) {
            return { success: false, error: 'İndirilecek PAK dosyası bulunamadı.' };
        }
        const pakDir = getPakDir(projectId);
        const source = axios_1.default.CancelToken.source();
        activeDownloads.set(projectId, source);
        const totalSize = pakFiles.reduce((s, f) => s + (f.size || 0), 0);
        let downloaded = 0;
        try {
            for (const pakFile of pakFiles) {
                const destPath = path_1.default.join(pakDir, pakFile.name);
                const response = await (0, axios_1.default)({
                    method: 'GET',
                    url: pakFile.url,
                    responseType: 'stream',
                    cancelToken: source.token,
                    timeout: 0,
                });
                const writer = fs_1.default.createWriteStream(destPath);
                response.data.on('data', (chunk) => {
                    downloaded += chunk.length;
                    const progress = totalSize > 0
                        ? Math.min(Math.round((downloaded / totalSize) * 100), 99)
                        : 0;
                    if (!win.isDestroyed()) {
                        win.webContents.send('pak:progress', {
                            projectId,
                            progress,
                            status: `${pakFile.name} indiriliyor... %${progress}`,
                        });
                    }
                });
                // pipeAndWait: listener'lar pipe'dan ÖNCE kurulur, race condition yok
                await pipeAndWait(response.data, writer, source.token);
                // Hash doğrulama (hash tanımlıysa)
                if (pakFile.hash && pakFile.hash.trim() !== '') {
                    const calculated = await calcMd5(destPath);
                    if (calculated !== pakFile.hash.toUpperCase()) {
                        fs_1.default.unlinkSync(destPath);
                        throw new Error(`Hash uyumsuz: ${pakFile.name} (beklenen: ${pakFile.hash}, hesaplanan: ${calculated})`);
                    }
                }
            }
            // Tüm PAK'lar indi → versiyonu kaydet
            const version = pakFiles[0]?.version || '1.0.0';
            writeInstalledVersion(projectId, version);
            activeDownloads.delete(projectId);
            if (!win.isDestroyed()) {
                win.webContents.send('pak:progress', { projectId, progress: 100, status: 'Kurulum tamamlandı!' });
                win.webContents.send('pak:complete', { projectId, success: true });
            }
            return { success: true };
        }
        catch (err) {
            activeDownloads.delete(projectId);
            // Yarım kalan dosyaları temizle
            if (fs_1.default.existsSync(pakDir)) {
                for (const f of pakFiles) {
                    const p = path_1.default.join(pakDir, f.name);
                    if (fs_1.default.existsSync(p))
                        try {
                            fs_1.default.unlinkSync(p);
                        }
                        catch { /* ignore */ }
                }
            }
            if (!win.isDestroyed()) {
                win.webContents.send('pak:error', { projectId, message: err.message });
            }
            return { success: false, error: err.message };
        }
    });
    // 3. Cross-origin dosya indirme (kullanıcı seçtiği konuma)
    electron_1.ipcMain.handle('file:download', async (_e, url, filename) => {
        try {
            const { filePath: destPath, canceled } = await electron_1.dialog.showSaveDialog(win, {
                defaultPath: filename,
            });
            if (canceled || !destPath) {
                return { success: false, canceled: true };
            }
            const response = await (0, axios_1.default)({
                method: 'GET',
                url,
                responseType: 'stream',
                timeout: 0,
            });
            const writer = fs_1.default.createWriteStream(destPath);
            await new Promise((resolve, reject) => {
                writer.on('finish', () => resolve());
                writer.on('error', (err) => reject(err));
                response.data.on('error', (err) => {
                    writer.destroy();
                    reject(err);
                });
                response.data.pipe(writer);
            });
            return { success: true, filePath: destPath };
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'Dosya indirilemedi.') };
        }
    });
    // 4. İndirmeyi iptal et
    electron_1.ipcMain.handle('pak:cancelDownload', (_e, projectId) => {
        const source = activeDownloads.get(projectId);
        if (source) {
            source.cancel('Kullanıcı tarafından iptal edildi.');
            activeDownloads.delete(projectId);
        }
    });
    // 4. PAK projesini başlat
    electron_1.ipcMain.handle('pak:launchProject', async (_e, _projectId, mapName) => {
        const exePath = path_1.default.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
        const map = (mapName || '').trim();
        if (!map) {
            return { success: false, message: 'Bu projeye henüz bir sahne (map) tanımlanmamış.' };
        }
        return launchArchilyaWithProfile(exePath, { mode: 'vr-project', mapName: map });
    });
    electron_1.ipcMain.handle('archilya:launch', async (_e, request) => {
        const exePath = path_1.default.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
        return launchArchilyaWithProfile(exePath, request);
    });
    electron_1.ipcMain.handle('streaming:start', async (_e, request = {}) => {
        const authContext = await getLaunchAuthContext();
        if (!authContext) {
            return { success: false, message: 'Web ile paylaşım başlatmak için giriş yapmanız gerekiyor.' };
        }
        return getStreamingOrchestrator().start(request, authContext);
    });
    electron_1.ipcMain.handle('streaming:stop', async () => {
        return getStreamingOrchestrator().stop('Web ile paylaşım kullanıcı tarafından durduruldu.');
    });
    electron_1.ipcMain.handle('streaming:status', async () => {
        return getStreamingOrchestrator().getStatus();
    });
    // ══════════════════════════════════════════════════════════════════════════
    // VR PROJELER (Admin Panel → products koleksiyonu)
    // NOT: check-project-status, download-project, cancel-project-download,
    //      delete-project ve launch-project handler'ları electron/projectManager.ts
    //      ve electron/main.ts tarafından zaten kaydediliyor.
    // ══════════════════════════════════════════════════════════════════════════
    electron_1.ipcMain.handle('get-projects', async () => {
        try {
            if (!firebase_1.auth.currentUser) {
                return { success: false, error: 'Oturum açmanız gerekiyor.' };
            }
            return await vrProjectService.getAssignedVrProjects(firebase_1.auth.currentUser.uid);
        }
        catch (err) {
            return { success: false, error: getErrorMessage(err, 'VR projeleri alınamadı.') };
        }
    });
}
// ── Temizlik ──────────────────────────────────────────────────────────────────
function removeIpcHandlers() {
    if (projectsUnsubscribe) {
        projectsUnsubscribe();
        projectsUnsubscribe = null;
    }
    activeDownloads.forEach(s => s.cancel('Uygulama kapanıyor.'));
    activeDownloads.clear();
    const channels = [
        'auth:login', 'auth:loginWithGoogle', 'auth:register', 'auth:logout', 'auth:loginGuest',
        'auth:resetPassword', 'auth:checkSession', 'auth:getSavedEmail',
        'settings:get', 'settings:update',
        'projects:subscribe', 'projects:unsubscribe',
        'projects:add', 'projects:update', 'projects:delete',
        'files:upload', 'files:delete',
        'sync:getLocalProjectPath', 'sync:project', 'sync:all',
        'sync:getStatus', 'sync:openProjectFolder', 'sync:setFolder',
        'sync:notifyOnline', 'sync:notifyFocus',
        'pak:checkStatus', 'pak:download', 'pak:cancelDownload', 'pak:launchProject', 'archilya:launch',
        'file:download',
        'streaming:start', 'streaming:stop', 'streaming:status',
        'get-projects',
        'fs:list', 'fs:watch', 'fs:unwatch',
    ];
    channels.forEach(ch => electron_1.ipcMain.removeHandler(ch));
    (0, aiHandlers_1.removeAiHandlers)();
    (0, fsHandlers_1.removeFsHandlers)();
    (0, versionHandlers_1.removeVersionHandlers)();
    if (syncService) {
        syncService.stop();
        syncService = null;
    }
    if (streamingOrchestrator) {
        void streamingOrchestrator.shutdown();
        streamingOrchestrator = null;
    }
}
async function shutdownStreamingInfrastructure() {
    if (!streamingOrchestrator) {
        return;
    }
    await streamingOrchestrator.shutdown();
}
async function startWebShareFromCore(request = {}) {
    const authContext = await getLaunchAuthContext();
    if (!authContext) {
        return { success: false, message: 'Web ile paylaşım için aktif kullanıcı oturumu yok.' };
    }
    return getStreamingOrchestrator().start(request, authContext);
}
async function stopWebShareFromCore() {
    return getStreamingOrchestrator().stop('Web ile paylaşım uzaktan komut ile durduruldu.');
}
async function getWebShareStatusFromCore() {
    return getStreamingOrchestrator().getStatus();
}
