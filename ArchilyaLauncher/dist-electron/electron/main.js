"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const electron_updater_1 = require("electron-updater");
const electron_store_1 = __importDefault(require("electron-store"));
const dotenv_1 = __importDefault(require("dotenv"));
const extract_zip_1 = __importDefault(require("extract-zip"));
// High-performance HTTP/HTTPS Agents for faster downloads
const httpsAgent = new https_1.default.Agent({
    keepAlive: true,
    maxSockets: 32,
    keepAliveMsecs: 1000,
});
const httpAgent = new http_1.default.Agent({
    keepAlive: true,
    maxSockets: 32,
    keepAliveMsecs: 1000,
});
const axiosInstance = axios_1.default.create({
    httpsAgent,
    httpAgent,
});
// Çevresel değŸişkenleri yükle (.env)
const envPaths = [
    path_1.default.join(process.cwd(), '.env'),
    path_1.default.join(process.resourcesPath, '.env'),
    path_1.default.join(__dirname, '.env'),
    path_1.default.join(__dirname, '..', '.env'),
    path_1.default.join(electron_1.app.getAppPath(), '.env')
];
for (const envPath of envPaths) {
    if (fs_1.default.existsSync(envPath)) {
        dotenv_1.default.config({ path: envPath });
        break;
    }
}
// Loglama ayarları (auto-updater için)
const electron_log_1 = __importDefault(require("electron-log"));
const projectManager_1 = require("./projectManager");
const vrProjectService_1 = require("../src/main/services/vrProjectService");
const ipcHandlers_1 = require("../src/main/ipcHandlers");
const firebase_1 = require("../src/main/firebase");
const gameService_1 = require("../src/main/services/gameService");
const launchProfileService_1 = require("../src/main/services/launchProfileService");
const archilyaProcessService_1 = require("../src/main/services/archilyaProcessService");
const remoteCommandListener_1 = require("../src/main/services/remoteCommandListener");
const machineIdentityService_1 = require("../src/main/services/machineIdentityService");
const authService_1 = require("../src/main/services/authService");
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_log_1.default.transports.file.level = 'info';
let mainWindow = null;
let tray = null;
let isQuitting = false;
const LAUNCHER_UPDATE_FEED_URL = 'https://github.com/nebulanovagame/ArchilyaLauncher/releases/latest/download';
// Veri Saklama (Auth)
const store = new electron_store_1.default();
// Auth oturumu Firebase SDK (auth.currentUser) üzerinden yönetilir
// Başlatma argümanlarını kontrol et (Sessiz mod için)
const isSilent = process.argv.includes('--silent');
// --- SINGLE INSTANCE LOCK ---
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
}
electron_1.app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        if (!mainWindow.isVisible())
            mainWindow.show();
        mainWindow.focus();
    }
});
// Sabitler
const APP_ROOT = electron_1.app.isPackaged ? path_1.default.join(__dirname, '../../') : path_1.default.join(__dirname, '../');
const APP_ICON_PATH = path_1.default.join(APP_ROOT, 'dist/icon.ico');
const GAME_INSTALL_PATH = path_1.default.join(electron_1.app.getPath('userData'), 'Archilya');
const GAME_ZIP_NAME = 'Archilya.zip';
const GAME_EXE_NAME = 'Archilya.exe';
let projectManager = null;
let projectWatcher = null;
let launcherUpdateWatcher = null;
let gameUpdateWatcher = null;
let remoteCommandListener = null;
// --- HELPER FUNCTIONS ---
async function fetchAuthorizedProjects() {
    // Firebase SDK'nın auth.currentUser'ını kullan (authService.ts ile senkron)
    const user = firebase_1.auth.currentUser;
    if (!user) {
        electron_log_1.default.info('[fetchAuthorizedProjects] Kullanıcı oturum açmamış.');
        return [];
    }
    const uid = user.uid;
    const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/nng-toma/databases/(default)/documents`;
    try {
        // projects koleksiyonundan, memberUids'de bu kullanıcının olduğu projeleri çek
        // REST API'de array-contains sorgusu: structuredQuery kullanmalıyız
        const queryPayload = {
            structuredQuery: {
                from: [{ collectionId: 'projects' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'memberUids' },
                        op: 'ARRAY_CONTAINS',
                        value: { stringValue: uid }
                    }
                }
            }
        };
        const token = await user.getIdToken();
        const queryResponse = await axios_1.default.post(`${FIRESTORE_BASE_URL}:runQuery`, queryPayload, { headers: { Authorization: `Bearer ${token}` } });
        const projects = queryResponse.data
            .filter((item) => item.document) // boş yanıtları atla
            .map((item) => {
            const doc = item.document;
            const projectData = parseFirestoreData(doc.fields);
            const id = doc.name.split('/').pop(); // document path'inden ID'yi al
            // map_name, title â†’ name vb. standartlaştır
            const mapName = projectData.map_name || projectData.mapName || projectData.levelName || projectData.level_name || '';
            const title = projectData.name || projectData.title || 'İsimsiz Proje';
            return {
                id,
                title,
                map_name: mapName,
                files: projectData.pak_files || projectData.files || [],
                ...projectData
            };
        })
            .filter((p) => {
            // Sadece pak_files veya files olan VR projelerini al
            return (p.pak_files && p.pak_files.length > 0) || (p.files && p.files.length > 0 && p.map_name);
        });
        // Sync disk with current projects
        if (projectManager) {
            projectManager.syncDisk(projects);
            projectManager.createLocalManifest(projects);
        }
        electron_log_1.default.info(`[fetchAuthorizedProjects] ${projects.length} VR proje bulundu.`);
        return projects;
    }
    catch (error) {
        electron_log_1.default.error('[fetchAuthorizedProjects] Firestore query error:', error.response?.data || error.message);
        return [];
    }
}
function startProjectWatcher() {
    if (projectWatcher)
        clearInterval(projectWatcher);
    projectWatcher = setInterval(async () => {
        if (!firebase_1.auth.currentUser || !mainWindow)
            return;
        const newProjects = await fetchAuthorizedProjects();
        mainWindow.webContents.send('projects-updated', newProjects);
    }, 30000); // 30 saniyede bir kontrol
    electron_log_1.default.info('Project watcher started (30s interval).');
}
function stopProjectWatcher() {
    if (projectWatcher) {
        clearInterval(projectWatcher);
        projectWatcher = null;
    }
}
function startLauncherUpdateWatcher() {
    if (launcherUpdateWatcher)
        clearInterval(launcherUpdateWatcher);
    launcherUpdateWatcher = setInterval(() => {
        electron_log_1.default.info('Background launcher update check triggered.');
        electron_updater_1.autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);
}
function stopLauncherUpdateWatcher() {
    if (launcherUpdateWatcher) {
        clearInterval(launcherUpdateWatcher);
        launcherUpdateWatcher = null;
    }
}
function startGameUpdateWatcher() {
    if (gameUpdateWatcher)
        clearInterval(gameUpdateWatcher);
    gameUpdateWatcher = setInterval(async () => {
        if (!mainWindow)
            return;
        const remote = await fetchRemoteManifest();
        const local = getLocalManifest();
        if (remote && local && remote.version !== local.version) {
            electron_log_1.default.info(`Background game update found: v${remote.version}`);
            mainWindow.webContents.send('game-update-available', remote);
        }
    }, 10 * 60 * 1000);
}
function stopGameUpdateWatcher() {
    if (gameUpdateWatcher) {
        clearInterval(gameUpdateWatcher);
        gameUpdateWatcher = null;
    }
}
function parseFirestoreData(fields) {
    const result = {};
    for (const key in fields) {
        const valueObj = fields[key];
        if ('stringValue' in valueObj)
            result[key] = valueObj.stringValue;
        else if ('integerValue' in valueObj)
            result[key] = parseInt(valueObj.integerValue);
        else if ('doubleValue' in valueObj)
            result[key] = parseFloat(valueObj.doubleValue);
        else if ('booleanValue' in valueObj)
            result[key] = valueObj.booleanValue;
        else if ('arrayValue' in valueObj) {
            result[key] = (valueObj.arrayValue.values || []).map((v) => {
                if (v.mapValue)
                    return parseFirestoreData(v.mapValue.fields);
                if ('stringValue' in v)
                    return v.stringValue;
                return v;
            });
        }
        else if ('mapValue' in valueObj) {
            result[key] = parseFirestoreData(valueObj.mapValue.fields);
        }
    }
    return result;
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1480,
        height: 920,
        minWidth: 1280,
        minHeight: 820,
        frame: false,
        resizable: true,
        backgroundColor: '#1f1f1f',
        show: !isSilent, // Sessiz modda ise gösterme
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Game status takibi için pencereyi set et
    (0, gameService_1.setMainWindowForGameStatus)(mainWindow);
    // Geliştirme modu mu yoksa Üretim modu mu?
    if (!electron_1.app.isPackaged) {
        const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
        electron_log_1.default.info(`Geliştirme modu: ${devUrl} yükleniyor...`);
        mainWindow.loadURL(devUrl);
    }
    else {
        // Üretim modu: dist-electron/electron/main.js konumundan ../../dist/index.html'e git
        const htmlPath = path_1.default.join(__dirname, '../../dist/index.html');
        electron_log_1.default.info(`Üretim modu: ${htmlPath} yükleniyor...`);
        mainWindow.loadFile(htmlPath);
    }
    // Yükleme hatalarını yakala ve geliştirme modunda DevTools aç
    mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        electron_log_1.default.error(`Sayfa yüklenemedi: ${errorCode} — ${errorDescription}`);
    });
    if (!electron_1.app.isPackaged) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    // Sessiz modda değilse kapatılınca uygulamadan çık
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
        return false;
    });
}
function createTray() {
    const iconPath = process.env.VITE_DEV_SERVER_URL
        ? path_1.default.join(__dirname, '../../public/icon.ico')
        : path_1.default.join(__dirname, '../../dist/icon.ico');
    const icon = electron_1.nativeImage.createFromPath(iconPath);
    tray = new electron_1.Tray(icon);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Archilya Launcher',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Aç',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            }
        },
        {
            label: 'Çıkış',
            click: () => {
                isQuitting = true;
                electron_1.app.quit();
            }
        }
    ]);
    tray.setToolTip('Archilya Launcher');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}
// Uygulama yaşam döngüsü
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    if (!mainWindow)
        return;
    projectManager = new projectManager_1.ProjectManager(mainWindow, GAME_INSTALL_PATH);
    // Firebase IPC handler'larını kaydet (auth, projeler, dosyalar)
    (0, ipcHandlers_1.registerIpcHandlers)(mainWindow);
    const machineIdentity = (0, machineIdentityService_1.getMachineIdentityMetadata)();
    remoteCommandListener = new remoteCommandListener_1.RemoteCommandListener(machineIdentity.machineId, {
        startStream: async (request) => (0, ipcHandlers_1.startWebShareFromCore)(request),
        stopStream: async () => (0, ipcHandlers_1.stopWebShareFromCore)(),
        getStreamStatus: async () => (0, ipcHandlers_1.getWebShareStatusFromCore)(),
    });
    remoteCommandListener.start();
    electron_log_1.default.info(`[remote-command] Dinleyici aktif. machineId=${machineIdentity.machineId} host=${machineIdentity.hostname}`);
    electron_1.ipcMain.handle('machine:getIdentity', async () => {
        return (0, machineIdentityService_1.getMachineIdentityMetadata)();
    });
    electron_1.ipcMain.handle('commands:getHistory', async (_event, limit = 40) => {
        if (!remoteCommandListener) {
            return [];
        }
        return remoteCommandListener.getHistory(limit);
    });
    // VR Projeler için launch handler (artık kullanılmıyor; pak:launchProject tercih edilir)
    electron_1.ipcMain.handle('launch-project', async (_, project) => {
        const firebaseUser = firebase_1.auth.currentUser;
        const authArgs = firebaseUser ? [
            `-UID=${firebaseUser.uid}`,
            `-DisplayName=${firebaseUser.displayName || 'Player'}`,
            `-IsGuest=${firebaseUser.isAnonymous ? '1' : '0'}`,
        ] : [];
        if (projectManager)
            return projectManager.launchProject(project, authArgs);
        return { success: false, message: 'Project manager initialized değil.' };
    });
    // Firestore REST API Entegrasyonu â€” VR Projeler (owned_project_ids â†’ products)
    electron_1.ipcMain.handle('get-projects', async () => {
        try {
            const projects = await (0, vrProjectService_1.getVrProjects)();
            // İlk yüklemede manifest oluştur ve diski senkronize et
            if (projectManager) {
                projectManager.createLocalManifest(projects);
                projectManager.syncDisk(projects);
            }
            if (projects.length > 0) {
                // Not: Burada eğŸer watcher mekanizması tekrar açılmak istenirse eklenebilir.
                // startProjectWatcher();
            }
            return projects;
        }
        catch (err) {
            electron_log_1.default.error('[main] get-projects error:', err);
            return [];
        }
    });
    // Kendi kendini güncelleme kontrolü
    electron_updater_1.autoUpdater.setFeedURL({
        provider: 'generic',
        url: LAUNCHER_UPDATE_FEED_URL,
    });
    electron_log_1.default.info(`[launcher-updater] Feed URL configured: ${LAUNCHER_UPDATE_FEED_URL}`);
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    startLauncherUpdateWatcher(); // Periyodik launcher kontrolü başlat
    startGameUpdateWatcher(); // Periyodik oyun kontrolü başlat
    // --- AutoUpdater Event Listeners (Arayüz BağŸlantısı) ---
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher-update-status', { status: 'checking' });
        }
    });
    electron_updater_1.autoUpdater.on('update-available', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher-update-status', { status: 'available' });
        }
    });
    electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher-update-status', {
                status: 'downloading',
                progress: Math.round(progressObj.percent)
            });
        }
    });
    electron_updater_1.autoUpdater.on('update-downloaded', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher-update-status', { status: 'downloaded', progress: 100 });
            // İndirme bittiğinde sessizce çıkıp yükle (Kullanıcıya bildirdikten kısa bir süre sonra)
            setTimeout(() => {
                isQuitting = true;
                electron_updater_1.autoUpdater.quitAndInstall(true, true);
            }, 3000);
        }
    });
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher-update-status', { status: 'none' });
        }
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('launcher-update-status', { status: 'error' });
        }
        electron_log_1.default.error('AutoUpdater Error:', err);
        // Hata olsa bile kullanıcıya yansıtmayabiliriz veya loglayabiliriz
    });
    if (isSilent) {
        electron_log_1.default.info('Sessiz modda başlatıldı, güncelleme kontrol ediliyor...');
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Tray olduğu için tamamen kapatmıyoruz, arka planda çalışsın
        // Ancak kullanıcı arayüzden çıkış derse kapanacak (isQuitting bayrağı ile)
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.on('before-quit', () => {
    isQuitting = true;
    electron_1.ipcMain.removeHandler('machine:getIdentity');
    electron_1.ipcMain.removeHandler('commands:getHistory');
    remoteCommandListener?.stop();
    remoteCommandListener = null;
    void (0, ipcHandlers_1.shutdownStreamingInfrastructure)();
    (0, ipcHandlers_1.removeIpcHandlers)();
});
electron_1.app.on('render-process-gone', () => {
    void (0, ipcHandlers_1.shutdownStreamingInfrastructure)();
});
electron_1.app.on('child-process-gone', () => {
    void (0, ipcHandlers_1.shutdownStreamingInfrastructure)();
});
const REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/nebulanovagame/ArchilyaGameData/refs/heads/main/game-manifest.json";
// const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/nebulanovagame/ArchilyaGameData/refs/heads/main/game-manifest.json'; // Alternatif
// Yardımcı Fonksiyonlar
async function fetchRemoteManifest() {
    try {
        electron_log_1.default.info(`Fetching remote manifest from: ${REMOTE_MANIFEST_URL}`);
        const response = await axios_1.default.get(REMOTE_MANIFEST_URL, {
            timeout: 10000,
            headers: { 'Cache-Control': 'no-cache' } // Cache'i devre dışı bırakalım
        });
        if (!response.data || typeof response.data !== 'object') {
            electron_log_1.default.error('Manifest verisi JSON formatında değil:', response.data);
            return null;
        }
        return response.data;
    }
    catch (error) {
        electron_log_1.default.error(`Remote manifest çekilemedi (${REMOTE_MANIFEST_URL}):`, error.message);
        if (error.response) {
            electron_log_1.default.error(`Response status: ${error.response.status}`);
        }
        return null;
    }
}
function getLocalManifest() {
    const manifestPath = path_1.default.join(GAME_INSTALL_PATH, 'local-manifest.json');
    if (fs_1.default.existsSync(manifestPath)) {
        try {
            return JSON.parse(fs_1.default.readFileSync(manifestPath, 'utf-8'));
        }
        catch (error) {
            electron_log_1.default.error('Local manifest okunamadı:', error);
            return null;
        }
    }
    return null;
}
// Auth çıkış — watcher'ları durdur ve Firebase SDK'dan çık
electron_1.ipcMain.handle('auth:logout', async () => {
    try {
        stopProjectWatcher();
        stopGameUpdateWatcher();
        // launcherWatcher'ı kapatmıyoruz çünkü launcher açık kaldığı sürece güncellenmeli
        if (projectManager)
            projectManager.clearAllProjects(); // Çıkışta temizle
        await (0, authService_1.logout)();
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
// 1. OYUN GÜNCELLEME KONTROLÜ
electron_1.ipcMain.handle('check-game-update', async () => {
    const remote = await fetchRemoteManifest();
    const local = getLocalManifest();
    if (!remote) {
        // İnternet yok veya sunucu hatası -> Local varsa oyna, yoksa hata
        if (local)
            return { status: 'offline-ready', localVersion: local.version };
        return { status: 'error', message: 'Sunucuya erişilemiyor ve Archilya yüklü değil.' };
    }
    if (remote.maintenanceMode) {
        return { status: 'maintenance', message: remote.maintenanceMessage };
    }
    if (!local) {
        return { status: 'not-installed', remoteManifest: remote };
    }
    // Versiyon kontrolü (Basit string karşılaştırma veya semver)
    if (remote.version !== local.version) {
        return { status: 'update-available', remoteManifest: remote, localVersion: local.version };
    }
    // Hash kontrolü (Opsiyonel ama güvenli: remote hash değŸişmişse güncelle)
    // if (remote.zipHash !== local.zipHash) ...
    return { status: 'ready', localVersion: local.version };
});
// 2. OYUN İNDİRME VE KURULUM (Bütünleşik Süreç)
electron_1.ipcMain.on('start-game-update', async (event, manifest) => {
    try {
        if (!fs_1.default.existsSync(GAME_INSTALL_PATH)) {
            fs_1.default.mkdirSync(GAME_INSTALL_PATH, { recursive: true });
        }
        const zipPath = path_1.default.join(GAME_INSTALL_PATH, 'temp_update.zip');
        // Önceki yarım kalan indirme varsa sil
        if (fs_1.default.existsSync(zipPath)) {
            fs_1.default.unlinkSync(zipPath);
        }
        // --- ÇOKLU PARÇA DESTEğİ ---
        // EğŸer manifest'te downloadParts varsa parçalı indir, yoksa eskisi gibi tekli indir
        const parts = manifest.downloadParts && manifest.downloadParts.length > 0
            ? manifest.downloadParts
            : (manifest.downloadUrl ? [{ url: manifest.downloadUrl, size: manifest.totalSize || 0 }] : []);
        if (parts.length === 0) {
            throw new Error('İndirme URLsi bulunamadı. Lütfen manifest dosyasını kontrol edin.');
        }
        // URL Geçerlilik Kontrolü
        for (const part of parts) {
            if (!part.url || !part.url.startsWith('http')) {
                throw new Error(`Geçersiz URL tespit edildi: ${part.url || 'Boş URL'}`);
            }
        }
        const totalSize = manifest.totalSize ||
            parts.reduce((acc, p) => acc + (p.size || 0), 0);
        let totalDownloaded = 0;
        let lastUpdate = 0;
        const SEGMENTS_PER_PART = 4; // Her bir dosyayı 4 parçaya bölerek hızı artırıyoruz
        const MAX_CONCURRENT_DOWNLOADS = 8; // Aynı anda en fazla 8 segment indir
        electron_log_1.default.info(`Turbo V2 İndirme başlatılıyor: ${parts.length} parça, segmentasyon: ${SEGMENTS_PER_PART}, toplam ~${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
        // Tüm segmentlerin listesini hazırla
        const allSegments = [];
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const partSize = part.size;
            if (partSize > 50 * 1024 * 1024) { // 50MB'tan büyük dosyaları böl
                const segmentSize = Math.ceil(partSize / SEGMENTS_PER_PART);
                for (let j = 0; j < SEGMENTS_PER_PART; j++) {
                    const start = j * segmentSize;
                    const end = Math.min((j + 1) * segmentSize - 1, partSize - 1);
                    allSegments.push({ partIndex: i, segIndex: j, url: part.url, start, end });
                }
            }
            else {
                allSegments.push({ partIndex: i, segIndex: 0, url: part.url, start: 0, end: partSize - 1 });
            }
        }
        // Segment indirme fonksiyonu
        const downloadSegment = async (seg) => {
            const segPath = path_1.default.join(GAME_INSTALL_PATH, `temp_part_${seg.partIndex}_seg_${seg.segIndex}.tmp`);
            try {
                const response = await axiosInstance({
                    method: 'GET',
                    url: seg.url,
                    responseType: 'stream',
                    headers: {
                        'Range': `bytes=${seg.start}-${seg.end}`
                    },
                    timeout: 60000
                });
                const writer = fs_1.default.createWriteStream(segPath, { highWaterMark: 1024 * 1024 });
                let segDownloaded = 0;
                response.data.on('data', (chunk) => {
                    segDownloaded += chunk.length;
                    totalDownloaded += chunk.length;
                    const now = Date.now();
                    if (now - lastUpdate > 500) { // UI yükünü azaltmak için 500ms
                        lastUpdate = now;
                        const progress = totalSize > 0
                            ? Math.min(Math.round((totalDownloaded / totalSize) * 100), 99)
                            : 0;
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('game-update-progress', {
                                step: 'downloading',
                                progress,
                                status: `Turbo V2 Aktif: %${progress} (${allSegments.length} segment, Multi-Range)`
                            });
                        }
                    }
                });
                response.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    response.data.on('error', reject);
                });
            }
            catch (err) {
                electron_log_1.default.error(`Segment hatası (Part ${seg.partIndex}, Seg ${seg.segIndex}):`, err.message);
                throw err;
            }
        };
        // Havuz mantığŸıyla (Concurrency) segmentleri indir
        const pool = [...allSegments];
        const workers = Array(Math.min(MAX_CONCURRENT_DOWNLOADS, pool.length)).fill(null).map(async () => {
            while (pool.length > 0) {
                const seg = pool.shift();
                if (seg)
                    await downloadSegment(seg);
            }
        });
        await Promise.all(workers);
        // BİRLEÅTİRME (Merge) - Önce segmentleri part dosyalarına, sonra partları zip'e
        electron_log_1.default.info("Segmentler birleştiriliyor...");
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-progress', {
                step: 'downloading',
                progress: 99,
                status: `Dosyalar optimize ediliyor...`
            });
        }
        for (let i = 0; i < parts.length; i++) {
            const partPath = path_1.default.join(GAME_INSTALL_PATH, `temp_part_${i}.tmp`);
            const finalPartWriter = fs_1.default.createWriteStream(partPath, { highWaterMark: 1024 * 1024 });
            // Bu part'a ait tüm segmentleri bul
            const partSegments = allSegments.filter(s => s.partIndex === i).sort((a, b) => a.segIndex - b.segIndex);
            for (const seg of partSegments) {
                const segPath = path_1.default.join(GAME_INSTALL_PATH, `temp_part_${seg.partIndex}_seg_${seg.segIndex}.tmp`);
                const segReader = fs_1.default.createReadStream(segPath);
                await new Promise((resolve, reject) => {
                    segReader.pipe(finalPartWriter, { end: false });
                    segReader.on('end', () => {
                        try {
                            fs_1.default.unlinkSync(segPath);
                        }
                        catch (e) { }
                        resolve();
                    });
                    segReader.on('error', reject);
                });
            }
            finalPartWriter.end();
            await new Promise(res => finalPartWriter.on('finish', res));
        }
        // Partları ana ZIP'te birleştir
        const zipWriter = fs_1.default.createWriteStream(zipPath, { highWaterMark: 1024 * 1024 });
        for (let i = 0; i < parts.length; i++) {
            const partPath = path_1.default.join(GAME_INSTALL_PATH, `temp_part_${i}.tmp`);
            const partReader = fs_1.default.createReadStream(partPath);
            await new Promise((resolve, reject) => {
                partReader.pipe(zipWriter, { end: false });
                partReader.on('end', () => {
                    try {
                        fs_1.default.unlinkSync(partPath);
                    }
                    catch (e) { }
                    resolve();
                });
                partReader.on('error', reject);
            });
        }
        zipWriter.end();
        await new Promise(res => zipWriter.on('finish', res));
        electron_log_1.default.info("Turbo V2 Birleştirme tamamlandı.");
        // Tüm parçalar indi, progress'i %100'e çek (doğŸrulama öncesi)
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-progress', {
                step: 'downloading',
                progress: 100,
                status: `İndirme tamamlandı, doğŸrulanıyor...`
            });
        }
        // 3. Hash Kontrolü
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-progress', { step: 'verifying', progress: 100, status: 'DoğŸrulanıyor...' });
        }
        const fileHash = await new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('md5'); // Manifest'teki hash türüne göre (md5/sha256)
            const stream = fs_1.default.createReadStream(zipPath);
            stream.on('data', d => hash.update(d));
            stream.on('end', () => resolve(hash.digest('hex').toUpperCase()));
            stream.on('error', reject);
        });
        // Not: Manifest'teki hash büyük harf/küçük harf durumuna dikkat
        if (fileHash !== manifest.zipHash.toUpperCase()) {
            throw new Error(`Hash uyumsuz! İnen: ${fileHash}, Beklenen: ${manifest.zipHash}`);
        }
        // 4. Çıkarma
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-progress', { step: 'extracting', progress: 100, status: 'Dosyalar çıkarılıyor...' });
        }
        // extract-zip kütüphanesi ile çıkarma (4GB+ zip64 destekler)
        electron_log_1.default.info(`extract-zip aracı ile çıkarma başlatılıyor: ${zipPath}`);
        try {
            await (0, extract_zip_1.default)(zipPath, { dir: GAME_INSTALL_PATH });
            electron_log_1.default.info("extract-zip ile çıkarma başarılı.");
        }
        catch (err) {
            electron_log_1.default.error(`extract-zip çıkarma hatası:`, err);
            throw new Error(`Çıkarma işlemi başarısız oldu: ${err.message}`);
        }
        // 5. Mühürleme (Finalize)
        fs_1.default.writeFileSync(path_1.default.join(GAME_INSTALL_PATH, 'local-manifest.json'), JSON.stringify(manifest, null, 2));
        // Temizlik
        if (fs_1.default.existsSync(zipPath)) {
            fs_1.default.unlinkSync(zipPath);
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-complete', { success: true });
        }
    }
    catch (error) {
        electron_log_1.default.error('Oyun güncelleme hatası:', error);
        // TEMİZLİK: Hata durumunda geçici dosyaları sil
        try {
            const files = fs_1.default.readdirSync(GAME_INSTALL_PATH);
            files.forEach(f => {
                if (f.startsWith('temp_part_') || f === 'temp_update.zip' || f.includes('_seg_')) {
                    const filePath = path_1.default.join(GAME_INSTALL_PATH, f);
                    if (fs_1.default.existsSync(filePath)) {
                        fs_1.default.unlinkSync(filePath);
                    }
                }
            });
        }
        catch (e) { }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-error', { message: error.message });
        }
    }
});
// 3. ARCHILYA BAŞLATMA
electron_1.ipcMain.handle('launch-game', async () => {
    const local = getLocalManifest();
    if (!local) {
        // Manifest yoksa eski usül kontrol veya hata
        const exePathOld = path_1.default.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
        if (fs_1.default.existsSync(exePathOld)) {
            // Fallback: Manifest yok ama exe var (Manuel atılmış olabilir)
        }
        else {
            return { success: false, message: 'Archilya yüklü değil (manifest bulunamadı).' };
        }
    }
    const exeName = local ? local.executableName : GAME_EXE_NAME;
    const exePath = path_1.default.join(GAME_INSTALL_PATH, exeName);
    if (!fs_1.default.existsSync(exePath)) {
        return { success: false, message: 'Archilya dosyası diskte bulunamadı.' };
    }
    if ((0, gameService_1.isGameRunning)()) {
        return { success: false, message: 'Archilya zaten çalışıyor.' };
    }
    // GİRİŞ KONTROLÜ: Kullanıcı giriş yapmamışsa Archilya başlatma
    const user = firebase_1.auth.currentUser;
    if (!user) {
        return { success: false, message: 'Archilya başlatmak için giriş yapmalısınız.' };
    }
    try {
        const idToken = await user.getIdToken(false);
        const args = (0, launchProfileService_1.buildLaunchArgs)((0, launchProfileService_1.createStandardLaunchProfile)(), {
            uid: user.uid,
            token: idToken,
            displayName: user.displayName || user.email?.split('@')[0] || 'ArchilyaUser',
            isGuest: user.isAnonymous,
            isVerified: user.emailVerified,
        });
        electron_log_1.default.info('Archilya başlatılıyor:', exePath, args);
        electron_log_1.default.info('Archilya başlatılıyor:', exePath, args);
        const proc = (0, archilyaProcessService_1.startArchilyaProcess)(exePath, args);
        (0, gameService_1.setGameProcess)(proc);
        proc.unref();
        return { success: true };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
});
// --- IPC HANDLERS (Pencere vb.) ---
electron_1.ipcMain.on('minimize-window', () => mainWindow?.minimize());
electron_1.ipcMain.on('close-window', () => {
    void (0, ipcHandlers_1.shutdownStreamingInfrastructure)();
    mainWindow?.hide();
});
electron_1.ipcMain.handle('get-app-version', () => electron_1.app.getVersion());
/* ESKİ KODLAR COMMENT OUT YAPILDI VEYA SİLİNDİ
// Eski download-game, check-game-status, verify-hash handlerları yerine yukarıdakiler kullanılacak.
*/
