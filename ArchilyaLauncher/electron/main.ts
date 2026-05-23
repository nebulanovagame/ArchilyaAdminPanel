import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import https from 'https';
import http from 'http';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import dotenv from 'dotenv';
import extract from 'extract-zip';

// High-performance HTTP/HTTPS Agents for faster downloads
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 1000,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 1000,
});

const axiosInstance = axios.create({
  httpsAgent,
  httpAgent,
});

// Çevresel değŸişkenleri yükle (.env)
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.resourcesPath, '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(app.getAppPath(), '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Loglama ayarları (auto-updater için)
import log from 'electron-log';
import { ProjectManager } from './projectManager';
import { getVrProjects } from '../src/main/services/vrProjectService';
import {
  registerIpcHandlers,
  removeIpcHandlers,
  shutdownStreamingInfrastructure,
  startWebShareFromCore,
  stopWebShareFromCore,
  getWebShareStatusFromCore,
} from '../src/main/ipcHandlers';
import { auth } from '../src/main/firebase';
import { setMainWindowForGameStatus, setGameProcess, isGameRunning } from '../src/main/services/gameService';
import { createStandardLaunchProfile, buildLaunchArgs } from '../src/main/services/launchProfileService';
import { startArchilyaProcess } from '../src/main/services/archilyaProcessService';
import { RemoteCommandListener } from '../src/main/services/remoteCommandListener';
import { getMachineIdentityMetadata } from '../src/main/services/machineIdentityService';
import { logout } from '../src/main/services/authService';
autoUpdater.logger = log;
log.transports.file.level = 'info';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const LAUNCHER_UPDATE_FEED_URL = 'https://github.com/nebulanovagame/ArchilyaLauncher/releases/latest/download';

// Veri Saklama (Auth)
const store = new Store();
// Auth oturumu Firebase SDK (auth.currentUser) üzerinden yönetilir

// Başlatma argümanlarını kontrol et (Sessiz mod için)
const isSilent = process.argv.includes('--silent');

// --- SINGLE INSTANCE LOCK ---
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

  // Sabitler
  const APP_ROOT = app.isPackaged ? path.join(__dirname, '../../') : path.join(__dirname, '../');
  const APP_ICON_PATH = path.join(APP_ROOT, 'dist/icon.ico');
  const GAME_INSTALL_PATH = path.join(app.getPath('userData'), 'Archilya');
  const GAME_ZIP_NAME = 'Archilya.zip';
  const GAME_EXE_NAME = 'Archilya.exe';

  let projectManager: ProjectManager | null = null;
  let projectWatcher: NodeJS.Timeout | null = null;
  let launcherUpdateWatcher: NodeJS.Timeout | null = null;
  let gameUpdateWatcher: NodeJS.Timeout | null = null;
  let remoteCommandListener: RemoteCommandListener | null = null;

  // --- HELPER FUNCTIONS ---
  async function fetchAuthorizedProjects(): Promise<any[]> {
    // Firebase SDK'nın auth.currentUser'ını kullan (authService.ts ile senkron)
    const user = auth.currentUser;
    if (!user) {
      log.info('[fetchAuthorizedProjects] Kullanıcı oturum açmamış.');
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
      const queryResponse = await axios.post(
        `${FIRESTORE_BASE_URL}:runQuery`,
        queryPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const projects = queryResponse.data
        .filter((item: any) => item.document) // boş yanıtları atla
        .map((item: any) => {
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
        .filter((p: any) => {
          // Sadece pak_files veya files olan VR projelerini al
          return (p.pak_files && p.pak_files.length > 0) || (p.files && p.files.length > 0 && p.map_name);
        });
      
      // Sync disk with current projects
      if (projectManager) {
        projectManager.syncDisk(projects);
        projectManager.createLocalManifest(projects);
      }
      
      log.info(`[fetchAuthorizedProjects] ${projects.length} VR proje bulundu.`);
      return projects;

    } catch (error: any) {
      log.error('[fetchAuthorizedProjects] Firestore query error:', error.response?.data || error.message);
      return [];
    }
  }

  function startProjectWatcher() {
    if (projectWatcher) clearInterval(projectWatcher);
    projectWatcher = setInterval(async () => {
      if (!auth.currentUser || !mainWindow) return;
      
      const newProjects = await fetchAuthorizedProjects();
      mainWindow.webContents.send('projects-updated', newProjects);
    }, 30000); // 30 saniyede bir kontrol
    log.info('Project watcher started (30s interval).');
  }

  function stopProjectWatcher() {
    if (projectWatcher) {
      clearInterval(projectWatcher);
      projectWatcher = null;
    }
  }

  function startLauncherUpdateWatcher() {
    if (launcherUpdateWatcher) clearInterval(launcherUpdateWatcher);
    launcherUpdateWatcher = setInterval(() => {
      log.info('Background launcher update check triggered.');
      autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);
  }

  function stopLauncherUpdateWatcher() {
    if (launcherUpdateWatcher) {
      clearInterval(launcherUpdateWatcher);
      launcherUpdateWatcher = null;
    }
  }

  function startGameUpdateWatcher() {
    if (gameUpdateWatcher) clearInterval(gameUpdateWatcher);
    gameUpdateWatcher = setInterval(async () => {
      if (!mainWindow) return;
      const remote = await fetchRemoteManifest();
      const local = getLocalManifest();
      if (remote && local && remote.version !== local.version) {
        log.info(`Background game update found: v${remote.version}`);
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

  function parseFirestoreData(fields: any): any {

  const result: any = {};
  for (const key in fields) {
    const valueObj = fields[key];
    if ('stringValue' in valueObj) result[key] = valueObj.stringValue;
    else if ('integerValue' in valueObj) result[key] = parseInt(valueObj.integerValue);
    else if ('doubleValue' in valueObj) result[key] = parseFloat(valueObj.doubleValue);
    else if ('booleanValue' in valueObj) result[key] = valueObj.booleanValue;
    else if ('arrayValue' in valueObj) {
      result[key] = (valueObj.arrayValue.values || []).map((v: any) => {
        if (v.mapValue) return parseFirestoreData(v.mapValue.fields);
        if ('stringValue' in v) return v.stringValue;
        return v;
      });
    } else if ('mapValue' in valueObj) {
      result[key] = parseFirestoreData(valueObj.mapValue.fields);
    }
  }
  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1280,
    minHeight: 820,
    frame: false,
    resizable: true,
    backgroundColor: '#1f1f1f',
    show: !isSilent, // Sessiz modda ise gösterme
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Game status takibi için pencereyi set et
  setMainWindowForGameStatus(mainWindow);

  // Geliştirme modu mu yoksa Üretim modu mu?
  if (!app.isPackaged) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    log.info(`Geliştirme modu: ${devUrl} yükleniyor...`);
    mainWindow.loadURL(devUrl);
  } else {
    // Üretim modu: dist-electron/electron/main.js konumundan ../../dist/index.html'e git
    const htmlPath = path.join(__dirname, '../../dist/index.html');
    log.info(`Üretim modu: ${htmlPath} yükleniyor...`);
    mainWindow.loadFile(htmlPath);
  }

  // Yükleme hatalarını yakala ve geliştirme modunda DevTools aç
  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    log.error(`Sayfa yüklenemedi: ${errorCode} — ${errorDescription}`);
  });

  if (!app.isPackaged) {
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
    ? path.join(__dirname, '../../public/icon.ico') 
    : path.join(__dirname, '../../dist/icon.ico');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
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
        app.quit();
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
app.whenReady().then(() => {
  createWindow();
  createTray();

  if (!mainWindow) return;

  projectManager = new ProjectManager(mainWindow, GAME_INSTALL_PATH);

  // Firebase IPC handler'larını kaydet (auth, projeler, dosyalar)
  registerIpcHandlers(mainWindow);

  const machineIdentity = getMachineIdentityMetadata();
  remoteCommandListener = new RemoteCommandListener(machineIdentity.machineId, {
    startStream: async (request) => startWebShareFromCore(request),
    stopStream: async () => stopWebShareFromCore(),
    getStreamStatus: async () => getWebShareStatusFromCore(),
  });
  remoteCommandListener.start();
  log.info(`[remote-command] Dinleyici aktif. machineId=${machineIdentity.machineId} host=${machineIdentity.hostname}`);

  ipcMain.handle('machine:getIdentity', async () => {
    return getMachineIdentityMetadata();
  });

  ipcMain.handle('commands:getHistory', async (_event, limit: number = 40) => {
    if (!remoteCommandListener) {
      return [];
    }

    return remoteCommandListener.getHistory(limit);
  });

  // VR Projeler için launch handler (artık kullanılmıyor; pak:launchProject tercih edilir)
  ipcMain.handle('launch-project', async (_, project) => {
    const firebaseUser = auth.currentUser;
    const authArgs = firebaseUser ? [
      `-UID=${firebaseUser.uid}`,
      `-DisplayName=${firebaseUser.displayName || 'Player'}`,
      `-IsGuest=${firebaseUser.isAnonymous ? '1' : '0'}`,
    ] : [];

    if (projectManager) return projectManager.launchProject(project, authArgs);
    return { success: false, message: 'Project manager initialized değil.' };
  });
  
  // Firestore REST API Entegrasyonu â€” VR Projeler (owned_project_ids â†’ products)
  ipcMain.handle('get-projects', async () => {
    try {
      const projects = await getVrProjects();
      
      // İlk yüklemede manifest oluştur ve diski senkronize et
      if (projectManager) {
        projectManager.createLocalManifest(projects as any[]);
        projectManager.syncDisk(projects as any[]);
      }

      if (projects.length > 0) {
        // Not: Burada eğŸer watcher mekanizması tekrar açılmak istenirse eklenebilir.
        // startProjectWatcher();
      }
      return projects;
    } catch (err: any) {
      log.error('[main] get-projects error:', err);
      return [];
    }
  });
  
  // Kendi kendini güncelleme kontrolü
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: LAUNCHER_UPDATE_FEED_URL,
  });
  log.info(`[launcher-updater] Feed URL configured: ${LAUNCHER_UPDATE_FEED_URL}`);
  autoUpdater.checkForUpdatesAndNotify();
  startLauncherUpdateWatcher(); // Periyodik launcher kontrolü başlat
  startGameUpdateWatcher();    // Periyodik oyun kontrolü başlat

  // --- AutoUpdater Event Listeners (Arayüz BağŸlantısı) ---
  
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-update-status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-update-status', { status: 'available' });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-update-status', { 
        status: 'downloading', 
        progress: Math.round(progressObj.percent) 
      });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-update-status', { status: 'downloaded', progress: 100 });
      // İndirme bittiğinde sessizce çıkıp yükle (Kullanıcıya bildirdikten kısa bir süre sonra)
      setTimeout(() => {
        isQuitting = true;
        autoUpdater.quitAndInstall(true, true);
      }, 3000);
    }
  });
  
  autoUpdater.on('update-not-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-update-status', { status: 'none' });
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launcher-update-status', { status: 'error' });
    }

    log.error('AutoUpdater Error:', err);
    // Hata olsa bile kullanıcıya yansıtmayabiliriz veya loglayabiliriz
  });

  if (isSilent) {
    log.info('Sessiz modda başlatıldı, güncelleme kontrol ediliyor...');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Tray olduğu için tamamen kapatmıyoruz, arka planda çalışsın
    // Ancak kullanıcı arayüzden çıkış derse kapanacak (isQuitting bayrağı ile)
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  ipcMain.removeHandler('machine:getIdentity');
  ipcMain.removeHandler('commands:getHistory');
  remoteCommandListener?.stop();
  remoteCommandListener = null;
  void shutdownStreamingInfrastructure();
  removeIpcHandlers();
});

app.on('render-process-gone', () => {
  void shutdownStreamingInfrastructure();
});

app.on('child-process-gone', () => {
  void shutdownStreamingInfrastructure();
});

// --- IPC HANDLERS ---

interface GameManifestPart {
  url: string;
  size: number;
}

interface GameManifest {
  version: string;
  buildDate: string;
  downloadUrl?: string;         // Geriye dönük uyumluluk için opsiyonel
  downloadParts?: GameManifestPart[]; // Çoklu parça desteği (.z01, .zip vb.)
  totalSize?: number;           // Tüm parçaların toplam byte boyutu
  zipHash: string;
  executableName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  patchNotes: string[];
}

const REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/nebulanovagame/ArchilyaGameData/refs/heads/main/game-manifest.json";
// const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/nebulanovagame/ArchilyaGameData/refs/heads/main/game-manifest.json'; // Alternatif

// Yardımcı Fonksiyonlar
async function fetchRemoteManifest(): Promise<GameManifest | null> {
  try {
    log.info(`Fetching remote manifest from: ${REMOTE_MANIFEST_URL}`);
    const response = await axios.get(REMOTE_MANIFEST_URL, { 
      timeout: 10000,
      headers: { 'Cache-Control': 'no-cache' } // Cache'i devre dışı bırakalım
    });
    
    if (!response.data || typeof response.data !== 'object') {
      log.error('Manifest verisi JSON formatında değil:', response.data);
      return null;
    }
    return response.data;
  } catch (error: any) {
    log.error(`Remote manifest çekilemedi (${REMOTE_MANIFEST_URL}):`, error.message);
    if (error.response) {
      log.error(`Response status: ${error.response.status}`);
    }
    return null;
  }
}

function getLocalManifest(): GameManifest | null {
  const manifestPath = path.join(GAME_INSTALL_PATH, 'local-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      log.error('Local manifest okunamadı:', error);
      return null;
    }
  }
  return null;
}

// Auth çıkış — watcher'ları durdur ve Firebase SDK'dan çık
ipcMain.handle('auth:logout', async () => {
  try {
    stopProjectWatcher();
    stopGameUpdateWatcher();
    // launcherWatcher'ı kapatmıyoruz çünkü launcher açık kaldığı sürece güncellenmeli
    if (projectManager) projectManager.clearAllProjects(); // Çıkışta temizle
    await logout();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// 1. OYUN GÜNCELLEME KONTROLÜ
ipcMain.handle('check-game-update', async () => {
  const remote = await fetchRemoteManifest();
  const local = getLocalManifest();

  if (!remote) {
    // İnternet yok veya sunucu hatası -> Local varsa oyna, yoksa hata
    if (local) return { status: 'offline-ready', localVersion: local.version };
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
ipcMain.on('start-game-update', async (event, manifest: GameManifest) => {
  try {
    if (!fs.existsSync(GAME_INSTALL_PATH)) {
      fs.mkdirSync(GAME_INSTALL_PATH, { recursive: true });
    }

    const zipPath = path.join(GAME_INSTALL_PATH, 'temp_update.zip');

    // Önceki yarım kalan indirme varsa sil
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
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

    log.info(`Turbo V2 İndirme başlatılıyor: ${parts.length} parça, segmentasyon: ${SEGMENTS_PER_PART}, toplam ~${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

    // Tüm segmentlerin listesini hazırla
    const allSegments: { partIndex: number, segIndex: number, url: string, start: number, end: number }[] = [];
    
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
      } else {
        allSegments.push({ partIndex: i, segIndex: 0, url: part.url, start: 0, end: partSize - 1 });
      }
    }

    // Segment indirme fonksiyonu
    const downloadSegment = async (seg: typeof allSegments[0]) => {
      const segPath = path.join(GAME_INSTALL_PATH, `temp_part_${seg.partIndex}_seg_${seg.segIndex}.tmp`);
      
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

        const writer = fs.createWriteStream(segPath, { highWaterMark: 1024 * 1024 });

        let segDownloaded = 0;
        response.data.on('data', (chunk: any) => {
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

        return new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
          response.data.on('error', reject);
        });
      } catch (err: any) {
        log.error(`Segment hatası (Part ${seg.partIndex}, Seg ${seg.segIndex}):`, err.message);
        throw err;
      }
    };

    // Havuz mantığŸıyla (Concurrency) segmentleri indir
    const pool = [...allSegments];
    const workers = Array(Math.min(MAX_CONCURRENT_DOWNLOADS, pool.length)).fill(null).map(async () => {
      while (pool.length > 0) {
        const seg = pool.shift();
        if (seg) await downloadSegment(seg);
      }
    });

    await Promise.all(workers);

    // BİRLEÅTİRME (Merge) - Önce segmentleri part dosyalarına, sonra partları zip'e
    log.info("Segmentler birleştiriliyor...");
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-update-progress', {
          step: 'downloading',
          progress: 99,
          status: `Dosyalar optimize ediliyor...`
        });
    }

    for (let i = 0; i < parts.length; i++) {
      const partPath = path.join(GAME_INSTALL_PATH, `temp_part_${i}.tmp`);
      const finalPartWriter = fs.createWriteStream(partPath, { highWaterMark: 1024 * 1024 });
      
      // Bu part'a ait tüm segmentleri bul
      const partSegments = allSegments.filter(s => s.partIndex === i).sort((a, b) => a.segIndex - b.segIndex);
      
      for (const seg of partSegments) {
        const segPath = path.join(GAME_INSTALL_PATH, `temp_part_${seg.partIndex}_seg_${seg.segIndex}.tmp`);
        const segReader = fs.createReadStream(segPath);
        
        await new Promise<void>((resolve, reject) => {
          segReader.pipe(finalPartWriter, { end: false });
          segReader.on('end', () => {
            try { fs.unlinkSync(segPath); } catch(e) {}
            resolve();
          });
          segReader.on('error', reject);
        });
      }
      finalPartWriter.end();
      await new Promise<void>(res => finalPartWriter.on('finish', res));
    }

    // Partları ana ZIP'te birleştir
    const zipWriter = fs.createWriteStream(zipPath, { highWaterMark: 1024 * 1024 });
    for (let i = 0; i < parts.length; i++) {
      const partPath = path.join(GAME_INSTALL_PATH, `temp_part_${i}.tmp`);
      const partReader = fs.createReadStream(partPath);
      
      await new Promise<void>((resolve, reject) => {
        partReader.pipe(zipWriter, { end: false });
        partReader.on('end', () => {
          try { fs.unlinkSync(partPath); } catch(e) {}
          resolve();
        });
        partReader.on('error', reject);
      });
    }
    zipWriter.end();
    await new Promise<void>(res => zipWriter.on('finish', res));

    log.info("Turbo V2 Birleştirme tamamlandı.");

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

    const fileHash = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('md5'); // Manifest'teki hash türüne göre (md5/sha256)
      const stream = fs.createReadStream(zipPath);
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
    log.info(`extract-zip aracı ile çıkarma başlatılıyor: ${zipPath}`);
    try {
      await extract(zipPath, { dir: GAME_INSTALL_PATH });
      log.info("extract-zip ile çıkarma başarılı.");
    } catch (err: any) {
      log.error(`extract-zip çıkarma hatası:`, err);
      throw new Error(`Çıkarma işlemi başarısız oldu: ${err.message}`);
    }

    // 5. Mühürleme (Finalize)
    fs.writeFileSync(path.join(GAME_INSTALL_PATH, 'local-manifest.json'), JSON.stringify(manifest, null, 2));
    
    // Temizlik
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game-update-complete', { success: true });
    }

  } catch (error: any) {
    log.error('Oyun güncelleme hatası:', error);
    
    // TEMİZLİK: Hata durumunda geçici dosyaları sil
    try {
      const files = fs.readdirSync(GAME_INSTALL_PATH);
      files.forEach(f => {
        if (f.startsWith('temp_part_') || f === 'temp_update.zip' || f.includes('_seg_')) {
          const filePath = path.join(GAME_INSTALL_PATH, f);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch(e) {}

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('game-update-error', { message: error.message });
    }
  }
});


// 3. ARCHILYA BAŞLATMA
ipcMain.handle('launch-game', async () => {
  const local = getLocalManifest();
  
  if (!local) {
     // Manifest yoksa eski usül kontrol veya hata
     const exePathOld = path.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
      if(fs.existsSync(exePathOld)) {
          // Fallback: Manifest yok ama exe var (Manuel atılmış olabilir)
      } else {
         return { success: false, message: 'Archilya yüklü değil (manifest bulunamadı).' };
      }
  }
  
  const exeName = local ? local.executableName : GAME_EXE_NAME;
  const exePath = path.join(GAME_INSTALL_PATH, exeName);
  
  if (!fs.existsSync(exePath)) {
      return { success: false, message: 'Archilya dosyası diskte bulunamadı.' };
  }

  if (isGameRunning()) {
    return { success: false, message: 'Archilya zaten çalışıyor.' };
  }

  // GİRİŞ KONTROLÜ: Kullanıcı giriş yapmamışsa Archilya başlatma
  const user = auth.currentUser;
  if (!user) {
    return { success: false, message: 'Archilya başlatmak için giriş yapmalısınız.' };
  }

  try {
      const idToken = await user.getIdToken(false);
      const args = buildLaunchArgs(createStandardLaunchProfile(), {
        uid: user.uid,
        token: idToken,
        displayName: user.displayName || user.email?.split('@')[0] || 'ArchilyaUser',
        isGuest: user.isAnonymous,
        isVerified: user.emailVerified,
      });

      log.info('Archilya başlatılıyor:', exePath, args);
      log.info('Archilya başlatılıyor:', exePath, args);

      const proc = startArchilyaProcess(exePath, args);
      setGameProcess(proc);
      proc.unref();
      return { success: true };

  } catch(e: any) {
      return { success: false, message: e.message };
  }
});


// --- IPC HANDLERS (Pencere vb.) ---

ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('close-window', () => {
  void shutdownStreamingInfrastructure();
  mainWindow?.hide();
});
ipcMain.handle('get-app-version', () => app.getVersion());

/* ESKİ KODLAR COMMENT OUT YAPILDI VEYA SİLİNDİ
// Eski download-game, check-game-status, verify-hash handlerları yerine yukarıdakiler kullanılacak.
*/


