"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const electron_updater_1 = require("electron-updater");
const electron_store_1 = __importDefault(require("electron-store"));
const dotenv_1 = __importDefault(require("dotenv"));
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
// Çevresel değişkenleri yükle (.env)
const envPaths = [
    path_1.default.join(process.cwd(), '.env'),
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
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_log_1.default.transports.file.level = 'info';
let mainWindow = null;
let tray = null;
let isQuitting = false;
// Veri Saklama (Auth)
const store = new electron_store_1.default();
let currentUser = null; // Aktif oturum bilgisi bellekte de tutulur
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
// --- HELPER FUNCTIONS ---
async function fetchAuthorizedProjects() {
    if (!currentUser || !currentUser.localId)
        return [];
    const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/nng-toma/databases/(default)/documents`;
    try {
        const userDocResponse = await axios_1.default.get(`${FIRESTORE_BASE_URL}/users/${currentUser.localId}`);
        const userData = parseFirestoreData(userDocResponse.data.fields);
        const projectIds = userData.owned_project_ids || [];
        if (projectIds.length === 0)
            return [];
        const projectPromises = projectIds.map(async (id) => {
            try {
                const projectResponse = await axios_1.default.get(`${FIRESTORE_BASE_URL}/products/${id}`);
                const projectData = parseFirestoreData(projectResponse.data.fields);
                // map_name alanını standartlaştır (Veritabanındaki farklı isimlendirmelere karşı)
                const mapName = projectData.map_name || projectData.mapName || projectData.levelName || projectData.level_name || '';
                return {
                    id,
                    ...projectData,
                    map_name: mapName
                };
            }
            catch (err) {
                console.error(`Project ${id} could not be fetched:`, err);
                return null;
            }
        });
        const projects = await Promise.all(projectPromises);
        const filteredProjects = projects.filter(p => p !== null);
        // Sync disk with current projects
        if (projectManager) {
            projectManager.syncDisk(filteredProjects);
            projectManager.createLocalManifest(filteredProjects); // JSON oluştur
        }
        return filteredProjects;
    }
    catch (error) {
        if (error.response?.status === 404)
            return [];
        console.error('Firestore fetch projects error:', error.message);
        return [];
    }
}
function startProjectWatcher() {
    if (projectWatcher)
        clearInterval(projectWatcher);
    projectWatcher = setInterval(async () => {
        if (!currentUser || !mainWindow)
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
        width: 1000,
        height: 600,
        frame: false,
        resizable: false,
        backgroundColor: '#1f1f1f',
        show: !isSilent, // Sessiz modda ise gösterme
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Geliştirme modu mu yoksa Üretim modu mu?
    if (!electron_1.app.isPackaged) {
        const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
        console.log(`Geliştirme modu: ${devUrl} yükleniyor...`);
        mainWindow.loadURL(devUrl);
    }
    else {
        // Üretim modu: dist-electron/electron/main.js konumundan ../../dist/index.html'e git
        const htmlPath = path_1.default.join(__dirname, '../../dist/index.html');
        console.log(`Üretim modu: ${htmlPath} yükleniyor...`);
        mainWindow.loadFile(htmlPath);
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
    electron_1.ipcMain.handle('launch-project', async (_, project) => {
        const authArgs = currentUser ? [
            `-UID=${currentUser.localId}`,
            `-Token=${currentUser.idToken}`,
            `-DisplayName=${currentUser.displayName || 'Player'}`,
            `-IsGuest=${currentUser.isAnonymous ? '1' : '0'}`,
            `-Verified=${currentUser.emailVerified ? '1' : '0'}`
        ] : [];
        if (projectManager)
            return projectManager.launchProject(project, authArgs);
        return { success: false, message: 'Project manager initialized değil.' };
    });
    // Firestore REST API Entegrasyonu
    electron_1.ipcMain.handle('get-projects', async () => {
        const projects = await fetchAuthorizedProjects();
        // İlk yüklemede manifest oluştur
        if (projectManager) {
            projectManager.createLocalManifest(projects);
        }
        if (projects.length > 0) {
            startProjectWatcher();
        }
        return projects;
    });
    // Kendi kendini güncelleme kontrolü
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    startLauncherUpdateWatcher(); // Periyodik launcher kontrolü başlat
    startGameUpdateWatcher(); // Periyodik oyun kontrolü başlat
    // --- AutoUpdater Event Listeners (Arayüz Bağlantısı) ---
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
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.error('AutoUpdater Error:', err);
        // Hata olsa bile kullanıcıya yansıtmayabiliriz veya loglayabiliriz
    });
    if (isSilent) {
        console.log('Sessiz modda başlatıldı, güncelleme kontrol ediliyor...');
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
// 0. AUTHENTICATION HANDLERS
// -------------------------------------------------------------------------
const AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const FALLBACK_API_KEY = 'AIzaSyCfmz3gjf_x3iQ5Ud_mJ-kHjOTpEmDYQtM';
electron_1.ipcMain.handle('auth-login', async (_event, { email, password, rememberMe }) => {
    const currentApiKey = process.env.VITE_FIREBASE_API_KEY || FALLBACK_API_KEY;
    try {
        const response = await axios_1.default.post(`${AUTH_BASE_URL}/accounts:signInWithPassword?key=${currentApiKey}`, {
            email,
            password,
            returnSecureToken: true
        });
        const userData = {
            localId: response.data.localId,
            email: response.data.email,
            idToken: response.data.idToken,
            refreshToken: response.data.refreshToken,
            expiresIn: response.data.expiresIn,
            displayName: response.data.displayName,
            emailVerified: response.data.registered // Firebase login response doesn't directly return emailVerified, we'll fetch it in check or assume false if not sure. 
            // Actually, lookup provides it.
        };
        // Detaylı kullanıcı bilgisini al (emailVerified için)
        const lookupResponse = await axios_1.default.post(`${AUTH_BASE_URL}/accounts:lookup?key=${currentApiKey}`, {
            idToken: userData.idToken
        });
        if (lookupResponse.data.users && lookupResponse.data.users[0]) {
            userData.emailVerified = lookupResponse.data.users[0].emailVerified;
        }
        // Belleğe al
        currentUser = userData;
        startProjectWatcher(); // Login sonrası watcher'ı başlat
        // Beni Hatırla seçildiyse diske kaydet
        if (rememberMe) {
            store.set('user_session', userData);
        }
        else {
            store.delete('user_session'); // Eski varsa sil
        }
        return { success: true, user: userData };
    }
    catch (error) {
        const firebaseErrorMessage = error.response?.data?.error?.message;
        console.error('Login Error:', firebaseErrorMessage || error.message);
        let errorMessage = 'Giriş başarısız.';
        if (firebaseErrorMessage === 'EMAIL_NOT_FOUND' || firebaseErrorMessage === 'INVALID_PASSWORD' || firebaseErrorMessage === 'INVALID_LOGIN_CREDENTIALS') {
            errorMessage = 'E-posta veya şifre hatalı.';
        }
        else if (firebaseErrorMessage === 'USER_DISABLED') {
            errorMessage = 'Bu hesap devre dışı bırakılmış.';
        }
        else if (firebaseErrorMessage === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
            errorMessage = 'Çok fazla deneme yaptınız. Lütfen bekleyin.';
        }
        else {
            errorMessage = `Giriş başarısız: ${firebaseErrorMessage || error.message}`;
        }
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('auth-login-guest', async () => {
    const currentApiKey = process.env.VITE_FIREBASE_API_KEY || FALLBACK_API_KEY;
    try {
        const response = await axios_1.default.post(`${AUTH_BASE_URL}/accounts:signUp?key=${currentApiKey}`, {
            returnSecureToken: true
        });
        const userData = {
            localId: response.data.localId,
            email: 'Guest',
            idToken: response.data.idToken,
            refreshToken: response.data.refreshToken,
            expiresIn: response.data.expiresIn,
            isAnonymous: true,
            emailVerified: true // Misafirler için engel olmasın
        };
        currentUser = userData;
        startProjectWatcher(); // Misafir girişi sonrası da başlat
        return { success: true, user: userData };
    }
    catch (error) {
        const firebaseErrorMessage = error.response?.data?.error?.message;
        console.error('Guest Login Error:', firebaseErrorMessage || error.message);
        let errorMessage = 'Misafir girişi başarısız.';
        if (firebaseErrorMessage === 'OPERATION_NOT_ALLOWED' || firebaseErrorMessage === 'ADMIN_ONLY_OPERATION') {
            errorMessage = 'Misafir Modu Devre Dışı: Lütfen Firebase Console üzerinden "Anonymous Sign-in" yöntemini etkinleştirin.';
        }
        else {
            errorMessage = `Misafir girişi hatası: ${firebaseErrorMessage || error.message}`;
        }
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('auth-register', async (_event, { email, password }) => {
    const currentApiKey = process.env.VITE_FIREBASE_API_KEY || FALLBACK_API_KEY;
    try {
        // 1. Hesap Oluştur
        const response = await axios_1.default.post(`${AUTH_BASE_URL}/accounts:signUp?key=${currentApiKey}`, {
            email,
            password,
            returnSecureToken: true
        });
        const userData = {
            localId: response.data.localId,
            email: response.data.email,
            idToken: response.data.idToken,
            emailVerified: false
        };
        // 2. Firestore Dökümanı Oluştur (users/{uid})
        const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/nng-toma/databases/(default)/documents`;
        try {
            await axios_1.default.patch(`${FIRESTORE_BASE_URL}/users/${userData.localId}?key=${currentApiKey}`, {
                fields: {
                    email: { stringValue: email },
                    uid: { stringValue: userData.localId },
                    owned_project_ids: { arrayValue: {} } // Boş dizi
                }
            });
            electron_log_1.default.info(`Firestore user document created for: ${email}`);
        }
        catch (fsError) {
            electron_log_1.default.error('Firestore creation failed during register:', fsError.response?.data || fsError.message);
            // Kritik değil, Auth oluştuğu için devam ediyoruz ama logluyoruz.
        }
        // 3. Doğrulama Maili Gönder
        await axios_1.default.post(`${AUTH_BASE_URL}/accounts:sendOobCode?key=${currentApiKey}`, {
            requestType: 'VERIFY_EMAIL',
            idToken: userData.idToken
        });
        return { success: true, user: userData, message: 'Kayıt başarılı! Lütfen e-postanızı doğrulayın.' };
    }
    catch (error) {
        const code = error.response?.data?.error?.message;
        let errorMessage = 'Kayıt başarısız.';
        if (code === 'EMAIL_EXISTS')
            errorMessage = 'Bu e-posta adresi zaten kullanımda.';
        else if (code === 'WEAK_PASSWORD')
            errorMessage = 'Şifre çok zayıf (en az 6 karakter).';
        return { success: false, error: errorMessage };
    }
});
electron_1.ipcMain.handle('auth-reset-password', async (_event, { email }) => {
    const currentApiKey = process.env.VITE_FIREBASE_API_KEY || FALLBACK_API_KEY;
    try {
        await axios_1.default.post(`${AUTH_BASE_URL}/accounts:sendOobCode?key=${currentApiKey}`, {
            requestType: 'PASSWORD_RESET',
            email
        });
        return { success: true, message: 'Şifre sıfırlama bağlantısı gönderildi.' };
    }
    catch (error) {
        return { success: false, error: 'E-posta gönderilemedi. Adresi kontrol edin.' };
    }
});
electron_1.ipcMain.handle('auth-check', async () => {
    const currentApiKey = process.env.VITE_FIREBASE_API_KEY || FALLBACK_API_KEY;
    // 1. Önce belleğe bak
    if (currentUser)
        return { success: true, user: currentUser };
    // 2. Diske bak
    const savedSession = store.get('user_session');
    if (savedSession && savedSession.idToken) {
        // Token geçerliliğini kontrol et (Opsiyonel ama önerilir: Get User Data)
        try {
            // Token doğrulaması için Firebase'e sor
            const response = await axios_1.default.post(`${AUTH_BASE_URL}/accounts:lookup?key=${currentApiKey}`, {
                idToken: savedSession.idToken
            });
            // Başarılı ise belleği güncelle
            currentUser = {
                ...savedSession,
                emailVerified: response.data.users && response.data.users[0] ? response.data.users[0].emailVerified : false
            };
            startProjectWatcher(); // Session check başarılı ise başlat
            return { success: true, user: currentUser };
        }
        catch (error) {
            // Token geçersiz ise oturumu düşür (Refresh Token mantığı buraya eklenebilir)
            // Şimdilik basitçe logout yapıyoruz
            store.delete('user_session');
            currentUser = null;
            return { success: false, error: 'Oturum süresi doldu.' };
        }
    }
    return { success: false };
});
electron_1.ipcMain.handle('auth-logout', async () => {
    stopProjectWatcher();
    stopGameUpdateWatcher();
    // launcherWatcher'ı kapatmıyoruz çünkü launcher açık kaldığı sürece güncellenmeli
    if (projectManager)
        projectManager.clearAllProjects(); // Çıkışta temizle
    store.delete('user_session');
    currentUser = null;
});
// 1. OYUN GÜNCELLEME KONTROLÜ
electron_1.ipcMain.handle('check-game-update', async () => {
    const remote = await fetchRemoteManifest();
    const local = getLocalManifest();
    if (!remote) {
        // İnternet yok veya sunucu hatası -> Local varsa oyna, yoksa hata
        if (local)
            return { status: 'offline-ready', localVersion: local.version };
        return { status: 'error', message: 'Sunucuya erişilemiyor ve oyun yüklü değil.' };
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
    // Hash kontrolü (Opsiyonel ama güvenli: remote hash değişmişse güncelle)
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
        // --- ÇOKLU PARÇA DESTEĞİ ---
        // Eğer manifest'te downloadParts varsa parçalı indir, yoksa eskisi gibi tekli indir
        const parts = manifest.downloadParts && manifest.downloadParts.length > 0
            ? manifest.downloadParts
            : (manifest.downloadUrl ? [{ url: manifest.downloadUrl, size: manifest.totalSize || 0 }] : []);
        if (parts.length === 0) {
            throw new Error('İndirme URL\'si bulunamadı. Lütfen manifest dosyasını kontrol edin.');
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
        // Havuz mantığıyla (Concurrency) segmentleri indir
        const pool = [...allSegments];
        const workers = Array(Math.min(MAX_CONCURRENT_DOWNLOADS, pool.length)).fill(null).map(async () => {
            while (pool.length > 0) {
                const seg = pool.shift();
                if (seg)
                    await downloadSegment(seg);
            }
        });
        await Promise.all(workers);
        // BİRLEŞTİRME (Merge) - Önce segmentleri part dosyalarına, sonra partları zip'e
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
        // Tüm parçalar indi, progress'i %100'e çek (doğrulama öncesi)
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-progress', {
                step: 'downloading',
                progress: 100,
                status: `İndirme tamamlandı, doğrulanıyor...`
            });
        }
        // 3. Hash Kontrolü
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-progress', { step: 'verifying', progress: 100, status: 'Doğrulanıyor...' });
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
        // Windows 10/11 yerleşik tar aracı ile çıkarma (AdmZip 2GB limitini aşmak için)
        electron_log_1.default.info(`Yerleşik tar aracı ile çıkarma başlatılıyor: ${zipPath}`);
        await new Promise((resolve, reject) => {
            // Çift tırnaklar yoldaki boşluklara karşı koruma sağlar.
            // -xf: eXtract File, -C: Change directory
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
                    reject(new Error(`Çıkarma işlemi başarısız oldu (Kod: ${code})`));
                }
            });
            extractProcess.on('error', (err) => {
                electron_log_1.default.error("tar spawn hatası:", err);
                reject(err);
            });
        });
        // 5. Mühürleme (Finalize)
        fs_1.default.writeFileSync(path_1.default.join(GAME_INSTALL_PATH, 'local-manifest.json'), JSON.stringify(manifest, null, 2));
        // Temizlik
        fs_1.default.unlinkSync(zipPath);
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
                    fs_1.default.unlinkSync(path_1.default.join(GAME_INSTALL_PATH, f));
                }
            });
        }
        catch (e) { }
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('game-update-error', { message: error.message });
        }
    }
});
// 3. OYUNU BAŞLATMA
electron_1.ipcMain.handle('launch-game', () => {
    const local = getLocalManifest();
    if (!local) {
        // Manifest yoksa eski usül kontrol veya hata
        const exePathOld = path_1.default.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
        if (fs_1.default.existsSync(exePathOld)) {
            // Fallback: Manifest yok ama exe var (Manuel atılmış olabilir)
        }
        else {
            return { success: false, message: 'Oyun yüklü değil (Manifest bulunamadı).' };
        }
    }
    const exeName = local ? local.executableName : GAME_EXE_NAME;
    const exePath = path_1.default.join(GAME_INSTALL_PATH, exeName);
    if (!fs_1.default.existsSync(exePath)) {
        return { success: false, message: 'Oyun dosyası diskte bulunamadı.' };
    }
    // GİRİŞ KONTROLÜ: Kullanıcı giriş yapmamışsa oyunu başlatma (Opsiyonel)
    if (!currentUser) {
        return { success: false, message: 'Oyunu başlatmak için giriş yapmalısınız.' };
    }
    try {
        // UNREAL ENGINE PARAMETRELERİ
        const args = [
            `-UID=${currentUser.localId}`,
            `-Token=${currentUser.idToken}`,
            `-DisplayName=${currentUser.displayName || 'Player'}`,
            `-IsGuest=${currentUser.isAnonymous ? '1' : '0'}`,
            `-Verified=${currentUser.emailVerified ? '1' : '0'}`
        ];
        console.log('Oyun başlatılıyor:', exePath, args);
        electron_log_1.default.info('Oyun başlatılıyor:', exePath, args);
        const gameProcess = (0, child_process_1.spawn)(exePath, args, {
            detached: true,
            cwd: path_1.default.dirname(exePath),
            stdio: 'ignore'
        });
        gameProcess.unref();
        return { success: true };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
});
// --- IPC HANDLERS (Pencere vb.) ---
electron_1.ipcMain.on('minimize-window', () => mainWindow?.minimize());
electron_1.ipcMain.on('close-window', () => mainWindow?.hide());
electron_1.ipcMain.handle('get-app-version', () => electron_1.app.getVersion());
/* ESKİ KODLAR COMMENT OUT YAPILDI VEYA SİLİNDİ
// Eski download-game, check-game-status, verify-hash handlerları yerine yukarıdakiler kullanılacak.
*/
