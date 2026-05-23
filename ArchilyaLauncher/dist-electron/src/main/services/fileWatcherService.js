"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileWatcherService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const chokidar_1 = __importDefault(require("chokidar"));
const storageService_1 = require("./storageService");
const electron_log_1 = __importDefault(require("electron-log"));
// ════════════════════════════════════════════════════════════
// DOSYA GÖZCÜSÜ SERVİSİ — Yerel Dosya Sistemi İzleme
// FAZ 2.3: Çöp filtresi + Oto-Kilit istihbaratı
// ════════════════════════════════════════════════════════════
// ── Gizli/Cöp/Yedek dosya filtreleri ───────────────────────
/** Görmezden gelinen dosya isimleri (tam eşleşme) */
const IGNORED_NAMES = new Set([
    'Thumbs.db',
    '.DS_Store',
    'desktop.ini',
    '.localized',
    'ehthumbs.db',
]);
/** Görmezden gelinen uzantılar (küçük harf) */
const IGNORED_EXTENSIONS = new Set([
    // AutoCAD kilit dosyaları (gizli izlenir ama listelenmez)
    '.dwl',
    '.dwl2',
    '.dwl3',
    // Revit yedekleri
    '.bak',
    '.0001.rvt',
    '.0002.rvt',
    '.0003.rvt',
    '.0004.rvt',
    '.0005.rvt',
    // Office geçici dosyalar
    '.tmp',
    '.temp',
    '~$',
    // SketchUp yedekleri
    '.skb',
    // Diğer geçici
    '.log',
    '.lock',
    '.part',
]);
/** AutoCAD kilit dosyası uzantıları (gizli izleme için) */
const CAD_LOCK_EXTENSIONS = new Set(['.dwl', '.dwl2', '.dwl3']);
/** Dosya filtresi: true dönerse DOSYA GÖRÜNMEZ (listelenmez) */
function shouldIgnoreFile(fileName) {
    // Tam isim eşleşmesi
    if (IGNORED_NAMES.has(fileName))
        return true;
    // Uzantı kontrolü
    const lower = fileName.toLowerCase();
    for (const ext of IGNORED_EXTENSIONS) {
        if (lower.endsWith(ext))
            return true;
    }
    // Office geçici dosya öneki (~$Dosya.docx)
    if (lower.startsWith('~$'))
        return true;
    return false;
}
/** Dosya bir AutoCAD kilit dosyası mı? */
function isCadLockFile(fileName) {
    const lower = fileName.toLowerCase();
    for (const ext of CAD_LOCK_EXTENSIONS) {
        if (lower.endsWith(ext))
            return true;
    }
    return false;
}
/** Kilit dosyasından asıl dosya adını çıkar (Zemin_Kat.dwl → Zemin_Kat.dwg) */
function getLockedFileName(lockFileName) {
    // .dwl, .dwl2, .dwl3 uzantılarını .dwg ile değiştir
    return lockFileName.replace(/\.dwl2?3?$/i, '.dwg');
}
// ── Servis Sınıfı ──────────────────────────────────────────
class FileWatcherService {
    watcher = null;
    win = null;
    watchedPath = null;
    projectId = null;
    setWindow(win) {
        this.win = win;
    }
    setProjectId(projectId) {
        this.projectId = projectId;
    }
    // ── Klasör içeriği listele ────────────────────────────────
    async listDirectory(directoryPath) {
        try {
            const resolved = path_1.default.resolve(directoryPath);
            if (!fs_1.default.existsSync(resolved)) {
                return { success: false, items: [], error: 'Klasör bulunamadı.' };
            }
            const stat = fs_1.default.statSync(resolved);
            if (!stat.isDirectory()) {
                return { success: false, items: [], error: 'Belirtilen yol bir klasör değil.' };
            }
            const entries = await fs_1.default.promises.readdir(resolved, { withFileTypes: true });
            const items = [];
            for (const entry of entries) {
                // FAZ 2.3: Çöp ve yedek dosyaları atla
                if (!entry.isDirectory() && shouldIgnoreFile(entry.name)) {
                    continue;
                }
                const absolutePath = path_1.default.join(resolved, entry.name);
                const entryStat = fs_1.default.statSync(absolutePath);
                items.push({
                    name: entry.name,
                    relativePath: entry.name,
                    absolutePath,
                    size: entryStat.size,
                    isDirectory: entry.isDirectory(),
                    modifiedAt: entryStat.mtime.toISOString(),
                    createdAt: entryStat.birthtime.toISOString(),
                });
            }
            // Klasörler önce, sonra dosyalar; her ikisi de alfabetik
            items.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                return a.name.localeCompare(b.name);
            });
            return { success: true, items };
        }
        catch (err) {
            electron_log_1.default.error('[FileWatcherService] listDirectory error:', err);
            return { success: false, items: [], error: err.message || 'Klasör listelenemedi.' };
        }
    }
    // ── İzlemeyi başlat ───────────────────────────────────────
    async startWatching(directoryPath, projectId) {
        try {
            const resolved = path_1.default.resolve(directoryPath);
            if (!fs_1.default.existsSync(resolved)) {
                return { success: false, error: 'Klasör bulunamadı.' };
            }
            const stat = fs_1.default.statSync(resolved);
            if (!stat.isDirectory()) {
                return { success: false, error: 'Belirtilen yol bir klasör değil.' };
            }
            // Eğer zaten izleniyorsa durdur
            if (this.watcher) {
                await this.watcher.close();
                this.watcher = null;
            }
            this.watchedPath = resolved;
            this.projectId = projectId || null;
            this.watcher = chokidar_1.default.watch(resolved, {
                ignored: /(^|[/\\])\../, // gizli dosyaları atla
                persistent: true,
                ignoreInitial: true,
                depth: 0,
            });
            const handleEvent = (eventType, filePath) => {
                const fileName = path_1.default.basename(filePath);
                const relativePath = path_1.default.relative(resolved, filePath);
                // ── FAZ 2.3: AutoCAD kilit dosyası istihbaratı ─────
                if (isCadLockFile(fileName)) {
                    const lockedFileName = getLockedFileName(fileName);
                    const lockedFilePath = path_1.default.join(resolved, lockedFileName);
                    if (eventType === 'add') {
                        // Kilit dosyası oluştu → asıl dosya kilitlendi
                        const lockEvent = {
                            relativePath: lockedFileName,
                            absolutePath: lockedFilePath,
                            status: 'locked',
                            lockedBy: process.env.USERNAME || process.env.USER || 'Bilinmeyen Kullanici',
                        };
                        this.emitLockEvent(lockEvent);
                        electron_log_1.default.info(`[FileWatcherService] 🔒 Kilit: ${lockedFileName} (${lockEvent.lockedBy})`);
                    }
                    else if (eventType === 'unlink') {
                        // Kilit dosyası silindi → asıl dosya serbest
                        const unlockEvent = {
                            relativePath: lockedFileName,
                            absolutePath: lockedFilePath,
                            status: 'unlocked',
                        };
                        this.emitLockEvent(unlockEvent);
                        electron_log_1.default.info(`[FileWatcherService] 🔓 Kilit kaldırıldı: ${lockedFileName}`);
                    }
                    // Kilit dosyaları kendileri fs:changed olarak gönderilmez
                    return;
                }
                // ── FAZ 2.3: Çöp/yedek filtreleme ──────────────────
                if (shouldIgnoreFile(fileName)) {
                    return; // sessizce atla
                }
                const isDirectory = fs_1.default.existsSync(filePath) ? fs_1.default.statSync(filePath).isDirectory() : false;
                // ── FAZ 2.4: Otomatik yükleme (add/change) ─────────
                if (!isDirectory && (eventType === 'add' || eventType === 'change') && this.projectId && this.win) {
                    electron_log_1.default.info(`[FileWatcherService] ☁️ Yükleme başlatılıyor: ${fileName} → ${this.projectId}`);
                    // Asenkron yükleme — event akışını bloke etme
                    (0, storageService_1.uploadFileToProject)(filePath, this.projectId, this.win).catch((err) => {
                        electron_log_1.default.error(`[FileWatcherService] Yükleme hatası (${fileName}):`, err);
                    });
                }
                const event = {
                    eventType,
                    relativePath,
                    absolutePath: filePath,
                    isDirectory,
                };
                // Eğer dosya hâlâ varsa stats ekle
                if (fs_1.default.existsSync(filePath) && !isDirectory) {
                    try {
                        const s = fs_1.default.statSync(filePath);
                        event.stats = {
                            size: s.size,
                            modifiedAt: s.mtime.toISOString(),
                        };
                    }
                    catch {
                        // stats alınamazsa sessizce devam et
                    }
                }
                this.emitEvent(event);
                electron_log_1.default.info(`[FileWatcherService] ${eventType}: ${relativePath}`);
            };
            this.watcher.on('add', (filePath) => handleEvent('add', filePath));
            this.watcher.on('change', (filePath) => handleEvent('change', filePath));
            this.watcher.on('unlink', (filePath) => handleEvent('unlink', filePath));
            this.watcher.on('error', (error) => {
                electron_log_1.default.error('[FileWatcherService] Watcher error:', error);
            });
            electron_log_1.default.info(`[FileWatcherService] İzleme başlatıldı: ${resolved}`);
            return { success: true };
        }
        catch (err) {
            electron_log_1.default.error('[FileWatcherService] startWatching error:', err);
            return { success: false, error: err.message || 'İzleme başlatılamadı.' };
        }
    }
    // ── İzlemeyi durdur ───────────────────────────────────────
    async stopWatching(directoryPath) {
        const requestedPath = directoryPath ? path_1.default.resolve(directoryPath) : null;
        if (requestedPath && this.watchedPath && requestedPath !== this.watchedPath) {
            return { success: true };
        }
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
            this.watchedPath = null;
            electron_log_1.default.info('[FileWatcherService] İzleme durduruldu.');
        }
        return { success: true };
    }
    // ── Event gönderimi ───────────────────────────────────────
    emitEvent(event) {
        if (!this.win || this.win.isDestroyed())
            return;
        this.win.webContents.send('fs:changed', event);
    }
    emitLockEvent(event) {
        if (!this.win || this.win.isDestroyed())
            return;
        this.win.webContents.send('fs:lockChanged', event);
    }
    // ── Temizlik ──────────────────────────────────────────────
    async shutdown() {
        await this.stopWatching();
        this.win = null;
    }
}
exports.fileWatcherService = new FileWatcherService();
exports.default = exports.fileWatcherService;
