import { ipcMain, dialog, app, type BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios, { type CancelTokenSource } from 'axios';
import type { Unsubscribe } from 'firebase/firestore';
import type { PakFile, CreateProjectData, LauncherSettings } from '../shared/types';
import type { LaunchRequest, LaunchAuthContext, LaunchProfile } from '../shared/launchProfiles';
import type { WebShareStartRequest } from '../shared/streamingTypes';
import { auth } from './firebase'; // auth import et
import { registerAiHandlers, removeAiHandlers } from './aiHandlers';
import { registerFsHandlers, removeFsHandlers } from './fsHandlers';
import { registerVersionHandlers, removeVersionHandlers } from './versionHandlers';
import { isGameRunning, setGameProcess } from './services/gameService';
import {
  createStandardLaunchProfile,
  createVrProjectLaunchProfile,
  buildLaunchArgs,
} from './services/launchProfileService';
import { startArchilyaProcess } from './services/archilyaProcessService';
import { StreamingOrchestrator } from './services/streamingOrchestrator';
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  logout,
  loginGuest,
  resetPassword,
  checkSession,
  getSavedEmail,
} from './services/authService';
import {
  subscribeToProjects,
  addProject,
  updateProject,
  deleteProject,
} from './services/projectService';
import {
  uploadFileToProject,
  deleteFileFromProject,
} from './services/storageService';
import { getSettings, updateSettings } from './services/settingsStore';
import * as vrProjectService from './services/vrProjectService';
import { SyncService } from './services/syncService';
import log from 'electron-log';

// ── Sabitler ─────────────────────────────────────────────────────────────────
const GAME_INSTALL_PATH = path.join(app.getPath('userData'), 'Archilya');
const PAKS_PATH         = path.join(GAME_INSTALL_PATH, 'Archilya', 'Content', 'Paks');
const GAME_EXE_NAME     = 'Archilya.exe';

function resolveSignallingScriptPath(): string {
  const envPath = process.env.ARCHILYA_SIGNAL_SCRIPT_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'SignallingWebServer', 'dist', 'index.js'),
        path.join(path.dirname(process.execPath), 'SignallingWebServer', 'dist', 'index.js'),
        path.join(process.cwd(), 'SignallingWebServer', 'dist', 'index.js'),
      ]
    : [
        path.join(process.cwd(), 'SignallingWebServer', 'dist', 'index.js'),
        path.join(app.getAppPath(), 'SignallingWebServer', 'dist', 'index.js'),
        path.join(path.dirname(app.getAppPath()), 'SignallingWebServer', 'dist', 'index.js'),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return envPath || candidates[0];
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

async function getLaunchAuthContext(): Promise<LaunchAuthContext | null> {
  const user = auth.currentUser;
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

async function launchArchilyaWithProfile(exePath: string, request: LaunchRequest): Promise<{ success: boolean; message?: string }> {
  if (!fs.existsSync(exePath)) {
    return { success: false, message: 'Archilya dosyası bulunamadı. Lütfen önce Archilya kurulumunu tamamlayın.' };
  }

  if (isGameRunning()) {
    return { success: false, message: 'Archilya zaten çalışıyor.' };
  }

  const authContext = await getLaunchAuthContext();
  if (!authContext) {
    return { success: false, message: 'Archilya başlatmak için giriş yapmanız gerekiyor.' };
  }

  let profile: LaunchProfile;
  switch (request.mode) {
    case 'standard':
      profile = createStandardLaunchProfile();
      break;
    case 'vr-project':
      profile = createVrProjectLaunchProfile(request.mapName || '');
      break;
    case 'pixel-streaming':
      {
        const startResult = await getStreamingOrchestrator().start(
          {
            mapName: request.mapName,
            streamerPort: request.pixelStreaming?.port,
          },
          authContext,
        );

        return {
          success: startResult.success,
          message: startResult.message,
        };
      }
    default:
      return { success: false, message: 'Desteklenmeyen başlatma modu.' };
  }

  try {
    const args = buildLaunchArgs(profile, authContext);
    log.info(`[archilya:launch] mode=${request.mode} map=${request.mapName || '-'} args=${args.join(' ')}`);
    const proc = startArchilyaProcess(exePath, args);
    setGameProcess(proc);
    proc.unref();
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || 'Archilya başlatılamadı.' };
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let projectsUnsubscribe: Unsubscribe | null = null;
// Proje başına aktif indirme kaynağı (iptal için)
const activeDownloads = new Map<string, CancelTokenSource>();
let syncService: SyncService | null = null;
let streamingOrchestrator: StreamingOrchestrator | null = null;

function getStreamingOrchestrator(): StreamingOrchestrator {
  if (!streamingOrchestrator) {
    streamingOrchestrator = new StreamingOrchestrator({
      signalling: {
        scriptPath: resolveSignallingScriptPath(),
        playerPort: 8080,
        streamerPort: 8888,
        nodeExecutable: process.env.ARCHILYA_NODE_PATH,
      },
      archilyaExecutablePath: path.join(GAME_INSTALL_PATH, GAME_EXE_NAME),
    });
  }

  return streamingOrchestrator;
}

// ════════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR — PAK SİSTEMİ
// ════════════════════════════════════════════════════════════════════════════

// Her proje için kendi klasörünü Paks altında oluştur
function getPakDir(projectId: string): string {
  const dir = path.join(PAKS_PATH, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Kurulu versiyon bilgisini oku (.pak-version dosyasından)
function readInstalledVersion(projectId: string): string | null {
  const versionFile = path.join(getPakDir(projectId), '.pak-version');
  if (!fs.existsSync(versionFile)) return null;
  try { return fs.readFileSync(versionFile, 'utf-8').trim(); }
  catch { return null; }
}

// Versiyonu diske yaz
function writeInstalledVersion(projectId: string, version: string): void {
  fs.writeFileSync(path.join(getPakDir(projectId), '.pak-version'), version, 'utf-8');
}

// Tüm PAK dosyaları diske kurulu mu kontrol et
function arePaksInstalled(projectId: string, pakFiles: PakFile[]): boolean {
  if (!pakFiles || pakFiles.length === 0) return false;
  const dir = getPakDir(projectId);
  return pakFiles.every(f => fs.existsSync(path.join(dir, f.name)));
}

// MD5 hash hesapla
function calcMd5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end',  () => resolve(hash.digest('hex').toUpperCase()));
    stream.on('error', reject);
  });
}

// ── FIX 1: %100'de takılma çözümü ──────────────────────────────────────────
// Promise'i pipe'dan ÖNCE kur: böylece küçük/hızlı dosyalarda bile
// 'close' eventini kaçırmayız. stream.pipeline kullanarak hem pipe hem
// hata yayılımı güvenli hale getirildi.
function pipeAndWait(
  source: NodeJS.ReadableStream,
  writer: fs.WriteStream,
  cancelToken: { promise: Promise<any> }
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const done  = (err?: Error) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve();
    };
    // Listener'ları pipe'dan ÖNCE kaydet
    writer.on('finish', () => done());
    writer.on('error',  (err: Error) => done(err));
    source.on('error',  (err: Error) => { writer.destroy(); done(err); });
    cancelToken.promise.then(() => {
      (source as any).destroy?.();
      writer.destroy();
      done(new Error('İndirme iptal edildi.'));
    });
    // Şimdi pipe et
    source.pipe(writer);
  });
}

// ── FIX 2: Kilitli dosyaları da silebilen güvenilir silme ──────────────────
async function safeRmDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) return;
  // Windows'ta kilitli dosyalar için birkaç deneme yap
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
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
export async function cleanupUnauthorizedPaks(authorizedProjectIds: string[]): Promise<void> {
  if (!fs.existsSync(PAKS_PATH)) return;
  try {
    const entries = await fs.promises.readdir(PAKS_PATH, { withFileTypes: true });
    const authorizedSet = new Set(authorizedProjectIds);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!authorizedSet.has(entry.name)) {
        const dirToRemove = path.join(PAKS_PATH, entry.name);
        try {
          await safeRmDir(dirToRemove);
          log.info(`[cleanup] Yetkisiz klasör silindi: ${entry.name}`);
        } catch (err) {
          log.warn(`[cleanup] Silinemedi: ${entry.name}`, err);
        }
      }
    }
  } catch (err) {
    log.error('[cleanup] cleanupUnauthorizedPaks error:', err);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// registerIpcHandlers
// ════════════════════════════════════════════════════════════════════════════

export function registerIpcHandlers(win: BrowserWindow): void {
  if (!syncService) {
    syncService = new SyncService(win);
  }

  // ── AI Motor (FAZ 2.1) ──────────────────────────────────────────────────
  registerAiHandlers(win);

  // ── Dosya Sistemi (FAZ 2.2) ─────────────────────────────────────────────
  registerFsHandlers(win);

  // ── Versiyon Yönetimi (FAZ 2.5) ─────────────────────────────────────────
  registerVersionHandlers(win);

  // ── Auth Yönetimi (Firebase SDK) ────────────────────────────────────────
  ipcMain.handle('auth:login', async (_e, email: string, password: string, rememberMe: boolean) => {
    return await loginWithEmail(email, password, rememberMe);
  });
  ipcMain.handle('auth:loginWithGoogle', async (_e, rememberMe: boolean) => {
    return await loginWithGoogle(rememberMe);
  });
  ipcMain.handle('auth:register', async (_e, email: string, password: string) => {
    return await registerWithEmail(email, password);
  });
  ipcMain.handle('auth:resetPassword', async (_e, email: string) => {
    return await resetPassword(email);
  });
  ipcMain.handle('auth:loginGuest', async () => {
    return await loginGuest();
  });
  ipcMain.handle('auth:checkSession', async () => {
    return await checkSession();
  });
  // auth:logout main.ts'te tutulur (project watcher durdurma için)
  ipcMain.handle('auth:getSavedEmail', async () => {
    return getSavedEmail();
  });

  // ── Ayarlar ──────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', async () => {
    try {
      return { success: true, settings: getSettings() };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Ayarlar okunamadı.') };
    }
  });

  ipcMain.handle('settings:update', async (_e, settings: Partial<LauncherSettings>) => {
    try {
      return { success: true, settings: updateSettings(settings) };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Ayarlar güncellenemedi.') };
    }
  });

  // ── Firebase Proje Yönetimi ─────────────────────────────────────────────
  ipcMain.handle('projects:subscribe', async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
      }

      if (projectsUnsubscribe) {
        projectsUnsubscribe();
        projectsUnsubscribe = null;
      }

      projectsUnsubscribe = subscribeToProjects(
        user.uid,
        (projects) => {
          if (!win.isDestroyed()) {
            win.webContents.send('projects:changed', projects);
          }
        },
        (err) => {
          const message = err.message || 'Projeler dinlenirken hata oluştu.';
          if (!win.isDestroyed()) {
            win.webContents.send('projects:error', message);
          }
        },
      );

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Proje aboneliği başlatılamadı.') };
    }
  });

  ipcMain.handle('projects:unsubscribe', async () => {
    try {
      if (projectsUnsubscribe) {
        projectsUnsubscribe();
        projectsUnsubscribe = null;
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Proje aboneliği durdurulamadı.') };
    }
  });

  ipcMain.handle('projects:add', async (_e, data: CreateProjectData) => {
    try {
      return await addProject(data);
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Proje oluşturulamadı.') };
    }
  });

  ipcMain.handle('projects:update', async (_e, id: string, data: Partial<CreateProjectData>) => {
    try {
      return await updateProject(id, data);
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Proje güncellenemedi.') };
    }
  });

  ipcMain.handle('projects:delete', async (_e, id: string) => {
    try {
      return await deleteProject(id);
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Proje silinemedi.') };
    }
  });

  // ── Dosya Yönetimi ──────────────────────────────────────────────────────
  ipcMain.handle('files:upload', async (_e, projectId: string) => {
    try {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      const selectedPaths = result.filePaths;
      for (const filePath of selectedPaths) {
        const uploadResult = await uploadFileToProject(filePath, projectId, win);
        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error || 'Dosya yüklenemedi.' };
        }
      }

      return { success: true, count: selectedPaths.length };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Dosya yüklenemedi.') };
    }
  });

  ipcMain.handle('files:delete', async (_e, projectId: string, file: any) => {
    return await deleteFileFromProject(projectId, file);
  });

  // ── Dosya Senkronizasyonu ────────────────────────────────────────────────
  ipcMain.handle('sync:getLocalProjectPath', async (_e, projectId: string) => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    return syncService.getLocalProjectPath(projectId);
  });

  ipcMain.handle('sync:project', async (_e, projectId: string) => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    await syncService.syncProject(projectId);
  });

  ipcMain.handle('sync:all', async () => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    await syncService.syncAllProjects();
  });

  ipcMain.handle('sync:getStatus', async (_e, projectId: string) => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    return syncService.getStatus(projectId);
  });

  ipcMain.handle('sync:openProjectFolder', async (_e, projectId: string) => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    await syncService.openProjectFolder(projectId);
  });

  ipcMain.handle('sync:setFolder', async () => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    const result = await dialog.showOpenDialog(win, {
      title: 'Senkronizasyon klasoru sec',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return syncService.getSyncRoot();
    }
    return syncService.setSyncRoot(result.filePaths[0]);
  });

  ipcMain.handle('sync:notifyOnline', async () => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    await syncService.handleNetworkOnline();
  });

  ipcMain.handle('sync:notifyFocus', async () => {
    if (!syncService) throw new Error('Sync servisi hazir degil.');
    await syncService.handleAppFocus();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAK / VR BUILD SİSTEMİ — SADECE LAUNCHER
  // ══════════════════════════════════════════════════════════════════════════

  // 1. PAK durumunu kontrol et (kurulu mu, güncel mi?)
  ipcMain.handle('pak:checkStatus', (_e, projectId: string, pakFiles: PakFile[], currentVersion: string) => {
    if (!pakFiles || pakFiles.length === 0) {
      return { status: 'not-installed', installedVersion: null, latestVersion: currentVersion || null };
    }

    const installedVersion = readInstalledVersion(projectId);
    const installed        = arePaksInstalled(projectId, pakFiles);

    if (!installed || !installedVersion) {
      return { status: 'not-installed', installedVersion: null, latestVersion: currentVersion };
    }
    if (currentVersion && installedVersion !== currentVersion) {
      return { status: 'update-available', installedVersion, latestVersion: currentVersion };
    }
    return { status: 'installed', installedVersion, latestVersion: currentVersion };
  });

  // 2. PAK dosyalarını indir
  ipcMain.handle('pak:download', async (_e, projectId: string, pakFiles: PakFile[]) => {
    if (!pakFiles || pakFiles.length === 0) {
      return { success: false, error: 'İndirilecek PAK dosyası bulunamadı.' };
    }

    const pakDir = getPakDir(projectId);
    const source = axios.CancelToken.source();
    activeDownloads.set(projectId, source);

    const totalSize  = pakFiles.reduce((s, f) => s + (f.size || 0), 0);
    let   downloaded = 0;

    try {
      for (const pakFile of pakFiles) {
        const destPath = path.join(pakDir, pakFile.name);

        const response = await axios({
          method:       'GET',
          url:          pakFile.url,
          responseType: 'stream',
          cancelToken:  source.token,
          timeout:      0,
        });

        const writer = fs.createWriteStream(destPath);

        response.data.on('data', (chunk: Buffer) => {
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
            fs.unlinkSync(destPath);
            throw new Error(`Hash uyumsuz: ${pakFile.name} (beklenen: ${pakFile.hash}, hesaplanan: ${calculated})`);
          }
        }
      }

      // Tüm PAK'lar indi → versiyonu kaydet
      const version = pakFiles[0]?.version || '1.0.0';
      writeInstalledVersion(projectId, version);
      activeDownloads.delete(projectId);

      if (!win.isDestroyed()) {
        win.webContents.send('pak:progress',  { projectId, progress: 100, status: 'Kurulum tamamlandı!' });
        win.webContents.send('pak:complete',  { projectId, success: true });
      }
      return { success: true };

    } catch (err: any) {
      activeDownloads.delete(projectId);
      // Yarım kalan dosyaları temizle
      if (fs.existsSync(pakDir)) {
        for (const f of pakFiles) {
          const p = path.join(pakDir, f.name);
          if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch { /* ignore */ }
        }
      }
      if (!win.isDestroyed()) {
        win.webContents.send('pak:error', { projectId, message: err.message });
      }
      return { success: false, error: err.message };
    }
  });

  // 3. Cross-origin dosya indirme (kullanıcı seçtiği konuma)
  ipcMain.handle('file:download', async (_e, url: string, filename: string) => {
    try {
      const { filePath: destPath, canceled } = await dialog.showSaveDialog(win, {
        defaultPath: filename,
      });

      if (canceled || !destPath) {
        return { success: false, canceled: true };
      }

      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: 0,
      });

      const writer = fs.createWriteStream(destPath);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', (err: Error) => reject(err));
        response.data.on('error', (err: Error) => {
          writer.destroy();
          reject(err);
        });
        response.data.pipe(writer);
      });

      return { success: true, filePath: destPath };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'Dosya indirilemedi.') };
    }
  });

  // 4. İndirmeyi iptal et
  ipcMain.handle('pak:cancelDownload', (_e, projectId: string) => {
    const source = activeDownloads.get(projectId);
    if (source) {
      source.cancel('Kullanıcı tarafından iptal edildi.');
      activeDownloads.delete(projectId);
    }
  });

  // 4. PAK projesini başlat
  ipcMain.handle('pak:launchProject', async (_e, _projectId: string, mapName: string) => {
    const exePath = path.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
    const map = (mapName || '').trim();
    if (!map) {
      return { success: false, message: 'Bu projeye henüz bir sahne (map) tanımlanmamış.' };
    }
    return launchArchilyaWithProfile(exePath, { mode: 'vr-project', mapName: map });
  });

  ipcMain.handle('archilya:launch', async (_e, request: LaunchRequest) => {
    const exePath = path.join(GAME_INSTALL_PATH, GAME_EXE_NAME);
    return launchArchilyaWithProfile(exePath, request);
  });

  ipcMain.handle('streaming:start', async (_e, request: WebShareStartRequest = {}) => {
    const authContext = await getLaunchAuthContext();
    if (!authContext) {
      return { success: false, message: 'Web ile paylaşım başlatmak için giriş yapmanız gerekiyor.' };
    }

    return getStreamingOrchestrator().start(request, authContext);
  });

  ipcMain.handle('streaming:stop', async () => {
    return getStreamingOrchestrator().stop('Web ile paylaşım kullanıcı tarafından durduruldu.');
  });

  ipcMain.handle('streaming:status', async () => {
    return getStreamingOrchestrator().getStatus();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // VR PROJELER (Admin Panel → products koleksiyonu)
  // NOT: check-project-status, download-project, cancel-project-download,
  //      delete-project ve launch-project handler'ları electron/projectManager.ts
  //      ve electron/main.ts tarafından zaten kaydediliyor.
  // ══════════════════════════════════════════════════════════════════════════
  ipcMain.handle('get-projects', async () => {
    try {
      if (!auth.currentUser) {
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
      }

      return await vrProjectService.getAssignedVrProjects(auth.currentUser!.uid);
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err, 'VR projeleri alınamadı.') };
    }
  });
}

// ── Temizlik ──────────────────────────────────────────────────────────────────
export function removeIpcHandlers(): void {
  if (projectsUnsubscribe) { projectsUnsubscribe(); projectsUnsubscribe = null; }
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
  channels.forEach(ch => ipcMain.removeHandler(ch));

  removeAiHandlers();
  removeFsHandlers();
  removeVersionHandlers();

  if (syncService) {
    syncService.stop();
    syncService = null;
  }

  if (streamingOrchestrator) {
    void streamingOrchestrator.shutdown();
    streamingOrchestrator = null;
  }
}

export async function shutdownStreamingInfrastructure(): Promise<void> {
  if (!streamingOrchestrator) {
    return;
  }

  await streamingOrchestrator.shutdown();
}

export async function startWebShareFromCore(request: WebShareStartRequest = {}) {
  const authContext = await getLaunchAuthContext();
  if (!authContext) {
    return { success: false, message: 'Web ile paylaşım için aktif kullanıcı oturumu yok.' };
  }

  return getStreamingOrchestrator().start(request, authContext);
}

export async function stopWebShareFromCore() {
  return getStreamingOrchestrator().stop('Web ile paylaşım uzaktan komut ile durduruldu.');
}

export async function getWebShareStatusFromCore() {
  return getStreamingOrchestrator().getStatus();
}
