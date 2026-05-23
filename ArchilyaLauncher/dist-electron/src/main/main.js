"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameProcess = void 0;
exports.notifyGameStatus = notifyGameStatus;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
const child_process_1 = require("child_process");
const ipcHandlers_1 = require("./ipcHandlers");
const authService_1 = require("./services/authService");
// --- ESM PATH AYARLARI ---
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
// --- LOGLAMA AYARLARI ---
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.info('Uygulama başlatılıyor (ESM Modu)...');
// --- GLOBAL DEĞİŞKENLER ---
let mainWindow = null;
let tray = null;
let isQuitting = false;
let gameProcess = null;
exports.gameProcess = gameProcess;
// Helper to notify renderer about game status
function notifyGameStatus(isRunning) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-status-changed', isRunning);
    }
}
// Başlatma argümanları
const isSilent = process.argv.includes('--silent');
// --- SABİTLER ---
const PUBLIC_PATH = electron_1.app.isPackaged
    ? path_1.default.join(process.resourcesPath, 'public')
    : path_1.default.join(__dirname, '../public');
const GAME_INSTALL_PATH = path_1.default.join(electron_1.app.getPath('userData'), 'Archilya');
const GAME_ZIP_NAME = 'Archilya.zip';
const GAME_EXE_NAME = 'Archilya.exe';
// --- SINGLE INSTANCE LOCK (Aynı anda 2 tane açılmasın) ---
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            if (!mainWindow.isVisible())
                mainWindow.show();
            mainWindow.focus();
        }
    });
    electron_1.app.whenReady().then(() => {
        createWindow();
        createTray();
        // Güncelleme kontrolü (Sessizce başlat)
        setTimeout(() => {
            electron_log_1.default.info('Güncelleme kontrolü başlatılıyor...');
            electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        }, 1500);
    });
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#1f1f1f',
        frame: false,
        show: false, // Hazır olunca göster
        icon: path_1.default.join(PUBLIC_PATH, 'icon.ico'),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools(); // İstersen aç
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        if (!isSilent)
            mainWindow?.show();
    });
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
        return false;
    });
    // Firebase IPC handler'larını kaydet
    (0, ipcHandlers_1.registerIpcHandlers)(mainWindow);
}
// Pencere kapanırken handler'ları temizle
electron_1.app.on('before-quit', () => {
    (0, ipcHandlers_1.removeIpcHandlers)();
});
function createTray() {
    let iconPath = path_1.default.join(PUBLIC_PATH, 'icon.ico');
    // Dosya yoksa hata vermesin diye kontrol
    if (!fs_1.default.existsSync(iconPath)) {
        // Yedek ikon yolu (development için)
        iconPath = path_1.default.join(__dirname, '../public/icon.ico');
    }
    const icon = electron_1.nativeImage.createFromPath(iconPath);
    tray = new electron_1.Tray(icon);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        { label: 'Archilya Launcher', enabled: false },
        { type: 'separator' },
        { label: 'Aç', click: () => mainWindow?.show() },
        { label: 'Çıkış', click: () => { isQuitting = true; electron_1.app.quit(); } }
    ]);
    tray.setToolTip('Archilya Launcher');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow?.show());
}
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Tray olduğu için tamamen kapatmıyoruz
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow();
});
// --- AUTO UPDATER (SESSİZ GÜNCELLEME BURADA) ---
electron_updater_1.autoUpdater.on('checking-for-update', () => {
    electron_log_1.default.info('Güncelleme kontrol ediliyor...');
    mainWindow?.webContents.send('launcher-update-status', { status: 'checking' });
});
electron_updater_1.autoUpdater.on('update-available', () => {
    electron_log_1.default.info('Güncelleme bulundu.');
    mainWindow?.webContents.send('launcher-update-status', { status: 'available' });
});
electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents.send('launcher-update-status', {
        status: 'downloading',
        progress: Math.round(progressObj.percent)
    });
});
electron_updater_1.autoUpdater.on('update-downloaded', () => {
    electron_log_1.default.info('Güncelleme indi.');
    mainWindow?.webContents.send('launcher-update-status', { status: 'downloaded', progress: 100 });
    // 🔥 İŞTE İSTEDİĞİN SESSİZ GÜNCELLEME AYARI 🔥
    setTimeout(() => {
        isQuitting = true;
        // (true, true) -> Sessiz kurulum, Kurulumdan sonra çalıştır
        electron_updater_1.autoUpdater.quitAndInstall(true, true);
    }, 3000);
});
electron_updater_1.autoUpdater.on('error', (err) => {
    electron_log_1.default.error('Güncelleme hatası:', err);
    mainWindow?.webContents.send('launcher-update-status', { status: 'error', message: err.message });
});
// --- IPC HANDLERS (OYUN İNDİRME VE BAŞLATMA) ---
electron_1.ipcMain.on('minimize-window', () => mainWindow?.minimize());
electron_1.ipcMain.on('close-window', () => mainWindow?.hide());
electron_1.ipcMain.handle('get-app-version', () => electron_1.app.getVersion());
// 1. OYUN İNDİRME
electron_1.ipcMain.on('download-game', async (_event, url) => {
    try {
        if (!fs_1.default.existsSync(GAME_INSTALL_PATH)) {
            fs_1.default.mkdirSync(GAME_INSTALL_PATH, { recursive: true });
        }
        const filePath = path_1.default.join(GAME_INSTALL_PATH, GAME_ZIP_NAME);
        electron_log_1.default.info(`İndirme başlatılıyor: ${url}`);
        const response = await (0, axios_1.default)({
            method: 'GET',
            url: url,
            responseType: 'stream',
        });
        const totalLength = response.headers['content-length'];
        let downloadedLength = 0;
        let lastUpdate = 0;
        const writer = fs_1.default.createWriteStream(filePath);
        response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            const progress = totalLength ? Math.round((downloadedLength / parseInt(totalLength)) * 100) : 0;
            const now = Date.now();
            if (now - lastUpdate > 200 || progress === 100) {
                lastUpdate = now;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('download-progress', {
                        progress,
                        status: `İndiriliyor... %${progress}`
                    });
                }
            }
        });
        response.data.pipe(writer);
        writer.on('finish', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-complete', { success: true, path: filePath });
            }
        });
        writer.on('error', (err) => {
            electron_log_1.default.error(err);
            mainWindow?.webContents.send('download-error', { message: err.message });
        });
    }
    catch (error) {
        electron_log_1.default.error(error);
        mainWindow?.webContents.send('download-error', { message: error.message });
    }
});
// 2. HASH KONTROLÜ VE ZIP ÇIKARMA
electron_1.ipcMain.handle('verify-hash', async (_event, expectedHash) => {
    try {
        const zipPath = path_1.default.join(GAME_INSTALL_PATH, GAME_ZIP_NAME);
        if (!fs_1.default.existsSync(zipPath)) {
            return { success: false, error: 'Dosya bulunamadı' };
        }
        const fileHash = await new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('md5');
            const stream = fs_1.default.createReadStream(zipPath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex').toUpperCase()));
            stream.on('error', (err) => reject(err));
        });
        const expected = expectedHash.toUpperCase();
        if (fileHash === expected) {
            mainWindow?.webContents.send('download-progress', { progress: 100, status: 'Dosyalar çıkarılıyor...' });
            // Windows 10/11 yerleşik tar aracı ile çıkarma (AdmZip 2GB limitini aşmak için)
            electron_log_1.default.info(`Yerleşik tar aracı ile çıkarma başlatılıyor: ${zipPath}`);
            await new Promise((resolve, reject) => {
                const extractProcess = (0, child_process_1.spawn)('tar.exe', ['-xf', zipPath, '-C', GAME_INSTALL_PATH], {
                    windowsHide: true,
                });
                extractProcess.on('close', (code) => {
                    if (code === 0) {
                        electron_log_1.default.info("tar aracı ile çıkarma başarılı.");
                        resolve();
                    }
                    else {
                        electron_log_1.default.error(`tar çıkarma hatası (Kod: ${code})`);
                        reject(new Error(`Çıkarma hatası (Kod: ${code})`));
                    }
                });
                extractProcess.on('error', (err) => {
                    electron_log_1.default.error("tar spawn hatası:", err);
                    reject(err);
                });
            });
            fs_1.default.writeFileSync(path_1.default.join(GAME_INSTALL_PATH, 'version.json'), JSON.stringify({
                currentHash: fileHash,
                lastUpdate: new Date().toISOString()
            }));
            fs_1.default.unlinkSync(zipPath); // Zipi sil
            return { success: true };
        }
        else {
            return { success: false, error: 'Hash Uyumsuz', calculatedHash: fileHash };
        }
    }
    catch (e) {
        electron_log_1.default.error('Verify hash/extraction error:', e);
        return { success: false, error: e.message };
    }
});
// 3. OYUNU BAŞLATMA
electron_1.ipcMain.handle('launch-game', () => {
    const exePath = path_1.default.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
    if (!fs_1.default.existsSync(exePath)) {
        return { success: false, message: 'Oyun dosyası bulunamadı.' };
    }
    if (gameProcess) {
        return { success: false, message: 'Oyun zaten çalışıyor.' };
    }
    const user = (0, authService_1.getCurrentUser)();
    const args = user ? [
        `-UID=${user.uid}`,
        `-DisplayName=${user.displayName || 'Player'}`,
        `-IsGuest=${user.isGuest ? '1' : '0'}`
    ] : [];
    try {
        exports.gameProcess = gameProcess = (0, child_process_1.spawn)(exePath, args, {
            detached: true,
            cwd: path_1.default.dirname(exePath),
            stdio: 'ignore'
        });
        notifyGameStatus(true);
        gameProcess.on('close', () => {
            exports.gameProcess = gameProcess = null;
            notifyGameStatus(false);
        });
        gameProcess.unref();
        return { success: true };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
});
