import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import axios, { CancelTokenSource } from 'axios';
import http from 'http';
import https from 'https';
import { httpsCallable } from 'firebase/functions';
import { spawn } from 'child_process';
import { auth, functions } from '../src/main/firebase';
// Lokal tip tanımları (bu dosya oyun PAK yönetimi için; Firebase projeleriyle karışmaz)
interface ProjectFile {
  name: string;
  url: string;
  size: number;
  storageProvider?: string;
  objectKey?: string | null;
  contentType?: string;
}

interface Project {
  id: string;
  title: string;
  map_name: string;
  files: ProjectFile[];
}

interface R2ProductDownloadUrlPayload {
  productId: string;
  objectKey: string;
  fileName: string;
  disposition?: 'attachment' | 'inline';
}

interface R2ProductDownloadUrlResult {
  success?: boolean;
  downloadUrl?: string;
}

function toBoundedPositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

const PROJECT_DOWNLOAD_PROGRESS_THROTTLE_MS = 350;
const PROJECT_DOWNLOAD_RETRY_ATTEMPTS = 3;
const PROJECT_DOWNLOAD_RETRY_BASE_DELAY_MS = 1200;
const PROJECT_DOWNLOAD_REQUEST_TIMEOUT_MS = 60000;
const PROJECT_DOWNLOAD_STREAM_BUFFER_BYTES = 1024 * 1024;
const PROJECT_DOWNLOAD_CONCURRENCY = toBoundedPositiveInt(
  process.env.ARCHILYA_PROJECT_DOWNLOAD_CONCURRENCY,
  2,
  1,
  4,
);

const projectDownloadHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 16,
  maxFreeSockets: 8,
  keepAliveMsecs: 1000,
});

const projectDownloadHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 16,
  maxFreeSockets: 8,
  keepAliveMsecs: 1000,
});

const projectDownloadAxios = axios.create({
  httpAgent: projectDownloadHttpAgent,
  httpsAgent: projectDownloadHttpsAgent,
  timeout: PROJECT_DOWNLOAD_REQUEST_TIMEOUT_MS,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

type ProjectStatus = 'NOT_INSTALLED' | 'INSTALLED' | 'DOWNLOADING';
import log from 'electron-log';

export class ProjectManager {
  private mainWindow: BrowserWindow;
  private gameInstallPath: string;
  private paksPath: string;
  private activeDownloads: Map<string, CancelTokenSource> = new Map();
  private protectedFiles: string[] = [
    'global.ucas',
    'global.utoc',
    'pakchunk0-Windows.pak',
    'pakchunk0-Windows.ucas',
    'pakchunk0-Windows.utoc',
    'pakchunk1002-Windows.pak',
    'pakchunk1002-Windows.ucas',
    'pakchunk1002-Windows.utoc',
    'pakchunk1003-Windows.pak',
    'pakchunk1003-Windows.ucas',
    'pakchunk1003-Windows.utoc'
  ];

  constructor(mainWindow: BrowserWindow, gameInstallPath: string) {
    this.mainWindow = mainWindow;
    this.gameInstallPath = gameInstallPath;
    this.paksPath = path.join(this.gameInstallPath, 'Archilya', 'Content', 'Paks');
    
    if (!fs.existsSync(this.paksPath)) {
      fs.mkdirSync(this.paksPath, { recursive: true });
    }

    this.setupHandlers();
  }

  private setupHandlers() {
    ipcMain.handle('check-project-status', async (_, project: Project) => {
      return this.checkProjectStatus(project);
    });

    ipcMain.handle('download-project', async (_, project: Project) => {
      return this.downloadProject(project);
    });

    ipcMain.handle('cancel-project-download', async (_, projectId: string) => {
      const source = this.activeDownloads.get(projectId);
      if (source) {
        source.cancel('User cancelled download');
        this.activeDownloads.delete(projectId);
        return true;
      }
      return false;
    });

    ipcMain.handle('delete-project', async (_, project: Project) => {
      return this.deleteProject(project);
    });
  }

  private resolveR2ObjectKey(file: ProjectFile): string {
    const rawObjectKey = typeof file.objectKey === 'string' ? file.objectKey.trim() : '';
    if (rawObjectKey) {
      return rawObjectKey;
    }

    const rawUrl = typeof file.url === 'string' ? file.url.trim() : '';
    if (!rawUrl.toLowerCase().startsWith('r2://')) {
      return '';
    }

    return rawUrl.slice(5).trim();
  }

  private needsSignedDownloadUrl(file: ProjectFile): boolean {
    const provider = typeof file.storageProvider === 'string'
      ? file.storageProvider.trim().toLowerCase()
      : '';
    const rawUrl = typeof file.url === 'string' ? file.url.trim().toLowerCase() : '';

    return provider === 'r2' || rawUrl.startsWith('r2://');
  }

  private mapR2DownloadUrlError(error: any, fileName: string): Error {
    const code = String(error?.code || '').toLowerCase();
    const rawMessage = String(error?.message || '').trim();

    if (code.includes('unauthenticated')) {
      return new Error(`${fileName}: Demo dosyasini indirmek icin giris yapmaniz gerekiyor.`);
    }

    if (code.includes('permission-denied')) {
      return new Error(`${fileName}: Bu demo dosyasina erisim yetkiniz yok.`);
    }

    if (code.includes('not-found') || code.includes('unimplemented')) {
      return new Error(
        `${fileName}: R2 indirme servisi bulunamadi. Launcher ve Cloud Function surumlerini guncelleyin.`,
      );
    }

    if (rawMessage) {
      return new Error(`${fileName}: R2 indirme baglantisi olusturulamadi (${rawMessage}).`);
    }

    return new Error(`${fileName}: R2 indirme baglantisi olusturulamadi.`);
  }

  private async resolveProjectFileDownloadUrl(projectId: string, file: ProjectFile): Promise<string> {
    const directUrl = typeof file.url === 'string' ? file.url.trim() : '';

    if (!this.needsSignedDownloadUrl(file)) {
      if (!directUrl) {
        throw new Error(`${file.name}: Indirme baglantisi bulunamadi.`);
      }
      return directUrl;
    }

    if (!auth.currentUser) {
      throw new Error(`${file.name}: Demo dosyasini indirmek icin aktif kullanici bulunamadi.`);
    }

    const objectKey = this.resolveR2ObjectKey(file);
    if (!objectKey) {
      throw new Error(`${file.name}: R2 objectKey bilgisi eksik.`);
    }

    try {
      const callable = httpsCallable<R2ProductDownloadUrlPayload, R2ProductDownloadUrlResult>(
        functions,
        'createR2ProductDownloadUrlSecure',
      );
      const response = await callable({
        productId: projectId,
        objectKey,
        fileName: file.name,
        disposition: 'attachment',
      });

      const signedUrl = String(response?.data?.downloadUrl || '').trim();
      if (!signedUrl) {
        throw new Error('downloadUrl bos dondu.');
      }

      return signedUrl;
    } catch (error: any) {
      throw this.mapR2DownloadUrlError(error, file.name);
    }
  }

  private isDownloadCancellationError(error: any): boolean {
    if (axios.isCancel(error)) {
      return true;
    }

    const code = String(error?.code || '').toUpperCase();
    if (code === 'ERR_CANCELED' || code === 'ERR_CANCELLED') {
      return true;
    }

    const message = String(error?.message || '').toLowerCase();
    return message.includes('canceled') || message.includes('cancelled');
  }

  private isRetryableDownloadError(error: any): boolean {
    const status = Number(error?.response?.status || 0);
    if (status === 408 || status === 409 || status === 425 || status === 429) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    if (status === 416) {
      return true;
    }

    const code = String(error?.code || '').toUpperCase();
    return [
      'ECONNRESET',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ESOCKETTIMEDOUT',
      'EPIPE',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ERR_NETWORK',
    ].includes(code);
  }

  private buildDownloadError(error: any, fileName: string): Error {
    const status = Number(error?.response?.status || 0);
    if (status > 0) {
      return new Error(`${fileName}: indirme hatasi (HTTP ${status}).`);
    }

    const message = String(error?.message || '').trim();
    if (message) {
      return new Error(`${fileName}: ${message}`);
    }

    return new Error(`${fileName}: bilinmeyen indirme hatasi.`);
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async downloadProjectFileWithRetry(
    projectId: string,
    file: ProjectFile,
    destinationPath: string,
    source: CancelTokenSource,
    setDownloadedBytes: (bytes: number) => void,
  ): Promise<void> {
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });

    const partialPath = `${destinationPath}.part`;
    if (fs.existsSync(partialPath)) {
      try {
        await fs.promises.unlink(partialPath);
      } catch {
        // ignore stale partial cleanup errors
      }
    }

    setDownloadedBytes(0);

    for (let attempt = 1; attempt <= PROJECT_DOWNLOAD_RETRY_ATTEMPTS; attempt += 1) {
      let downloaded = fs.existsSync(partialPath)
        ? (await fs.promises.stat(partialPath)).size
        : 0;
      setDownloadedBytes(downloaded);

      try {
        const downloadUrl = await this.resolveProjectFileDownloadUrl(projectId, file);

        const headers: Record<string, string> = {};
        if (downloaded > 0) {
          headers.Range = `bytes=${downloaded}-`;
        }

        const response = await projectDownloadAxios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'stream',
          cancelToken: source.token,
          headers,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        if (downloaded > 0 && response.status === 200) {
          downloaded = 0;
          setDownloadedBytes(0);
          await fs.promises.writeFile(partialPath, Buffer.alloc(0));
        }

        await new Promise<void>((resolve, reject) => {
          const writer = fs.createWriteStream(partialPath, {
            flags: downloaded > 0 ? 'a' : 'w',
            highWaterMark: PROJECT_DOWNLOAD_STREAM_BUFFER_BYTES,
          });
          let settled = false;

          const done = (error?: Error) => {
            if (settled) {
              return;
            }
            settled = true;
            if (error) {
              reject(error);
              return;
            }
            resolve();
          };

          response.data.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            setDownloadedBytes(downloaded);
          });

          response.data.on('error', (error: Error) => {
            writer.destroy();
            done(error);
          });

          writer.on('error', (error: Error) => {
            response.data.destroy();
            done(error);
          });

          writer.on('finish', () => done());

          source.token.promise.then(() => {
            response.data.destroy();
            writer.destroy(new Error('Download cancelled'));
          }).catch(() => undefined);

          response.data.pipe(writer);
        });

        if (file.size > 0) {
          const finalSize = (await fs.promises.stat(partialPath)).size;
          if (finalSize < file.size) {
            throw new Error(`${file.name}: eksik indirme algilandi.`);
          }
        }

        if (fs.existsSync(destinationPath)) {
          await fs.promises.unlink(destinationPath);
        }
        await fs.promises.rename(partialPath, destinationPath);
        return;
      } catch (error: any) {
        if (this.isDownloadCancellationError(error)) {
          throw new Error('Indirme iptal edildi.');
        }

        const status = Number(error?.response?.status || 0);
        if (status === 416) {
          downloaded = 0;
          setDownloadedBytes(0);
          await fs.promises.writeFile(partialPath, Buffer.alloc(0));
        }

        if (attempt >= PROJECT_DOWNLOAD_RETRY_ATTEMPTS || !this.isRetryableDownloadError(error)) {
          throw this.buildDownloadError(error, file.name);
        }

        const retryDelay = PROJECT_DOWNLOAD_RETRY_BASE_DELAY_MS * attempt;
        await this.wait(retryDelay);
      }
    }
  }

  public checkProjectStatus(project: Project): ProjectStatus {
    const allFilesExist = project.files.every(file => {
      const filePath = path.join(this.paksPath, file.name);
      return fs.existsSync(filePath);
    });

    return allFilesExist ? 'INSTALLED' : 'NOT_INSTALLED';
  }

  public async downloadProject(project: Project): Promise<{ success: boolean; message?: string }> {
    const totalSize = project.files.reduce((acc, file) => acc + (file.size || 0), 0);

    const source = axios.CancelToken.source();
    this.activeDownloads.set(project.id, source);

    const downloadedByFile = new Map<string, number>();
    let totalDownloaded = 0;
    let completedFiles = 0;
    let nextProgressEmitAt = 0;
    let lastProgress = -1;

    const setFileDownloaded = (fileKey: string, bytes: number) => {
      const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
      const previous = downloadedByFile.get(fileKey) || 0;
      if (safeBytes === previous) {
        return;
      }

      downloadedByFile.set(fileKey, safeBytes);
      totalDownloaded += safeBytes - previous;
      if (totalDownloaded < 0) {
        totalDownloaded = 0;
      }
    };

    const emitProgress = (status: string, force = false) => {
      const now = Date.now();
      if (!force && now < nextProgressEmitAt) {
        return;
      }

      let progress = 0;
      if (totalSize > 0) {
        progress = Math.round((totalDownloaded / totalSize) * 100);
        progress = Math.max(0, Math.min(progress, force ? 100 : 99));
      } else if (project.files.length > 0) {
        progress = Math.round((completedFiles / project.files.length) * 100);
        progress = Math.max(0, Math.min(progress, force ? 100 : 99));
      } else {
        progress = force ? 100 : 0;
      }

      if (!force && progress === lastProgress) {
        return;
      }

      nextProgressEmitAt = now + PROJECT_DOWNLOAD_PROGRESS_THROTTLE_MS;
      lastProgress = progress;

      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('project-progress', {
          projectId: project.id,
          progress,
          status,
        });
      }
    };

    try {
      emitProgress('Indirme hazirlaniyor...', true);

      const queue = project.files.map((file, index) => ({
        file,
        fileKey: `${index}:${file.name}`,
      }));
      let cursor = 0;
      let firstError: Error | null = null;

      const workerCount = Math.max(1, Math.min(PROJECT_DOWNLOAD_CONCURRENCY, queue.length || 1));

      const worker = async () => {
        while (true) {
          if (firstError) {
            return;
          }

          const current = queue[cursor];
          cursor += 1;
          if (!current) {
            return;
          }

          const { file, fileKey } = current;
          const filePath = path.join(this.paksPath, file.name);

          try {
            await this.downloadProjectFileWithRetry(
              project.id,
              file,
              filePath,
              source,
              (bytes) => {
                setFileDownloaded(fileKey, bytes);
                emitProgress(`${file.name} indiriliyor...`);
              },
            );

            completedFiles += 1;
            emitProgress(`${completedFiles}/${queue.length} dosya tamamlandi`, true);
          } catch (error: any) {
            if (!firstError) {
              firstError = error instanceof Error
                ? error
                : new Error(String(error?.message || error));
              source.cancel(firstError.message || 'Project download failed');
            }
            return;
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      if (firstError) {
        throw firstError;
      }

      emitProgress('Kurulum tamamlandi!', true);
      return { success: true };
    } catch (error: any) {
      for (const file of project.files) {
        const filePath = path.join(this.paksPath, file.name);
        const partialPath = `${filePath}.part`;

        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // ignore cleanup errors
          }
        }

        if (fs.existsSync(partialPath)) {
          try {
            fs.unlinkSync(partialPath);
          } catch {
            // ignore cleanup errors
          }
        }
      }

      const message = this.isDownloadCancellationError(error)
        ? 'Indirme iptal edildi.'
        : (error?.message || 'Indirme basarisiz oldu.');

      return { success: false, message };
    } finally {
      this.activeDownloads.delete(project.id);
    }
  }

  public createLocalManifest(projects: Project[]) {
    // Hedef: .../Archilya/Saved/LocalProjects.json
    const savedDir = path.join(this.gameInstallPath, 'Archilya', 'Saved');
    
    if (!fs.existsSync(savedDir)) {
      try {
        fs.mkdirSync(savedDir, { recursive: true });
      } catch (e) {
        log.error('Saved directory could not be created:', e);
        return;
      }
    }

    const manifestPath = path.join(savedDir, 'LocalProjects.json');
    
    const data = {
      projects: projects.map(p => ({
        title: p.title,
        map_name: p.map_name
      }))
    };

    try {
      fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
      log.info('LocalProjects.json created successfully at:', manifestPath);
    } catch (error) {
      log.error('Failed to write LocalProjects.json:', error);
    }
  }

  public async launchProject(project: Project, authArgs: string[] = []) {
    const exePath = path.join(this.gameInstallPath, 'Archilya.exe'); 
    
    if (!fs.existsSync(exePath)) {
      return { success: false, message: 'Oyun dosyası bulunamadı.' };
    }

    // SENARYO B: Direkt Proje Başlatma
    const mapName = (project.map_name || '').trim();
    if (!mapName) {
      log.warn(`[Launch] Warning: Project ${project.id} has no map_name defined. Game will launch to default menu.`);
    }

    // Auth Argümanları (UID, Token vb.) authArgs içinde gelmelidir.
    const args = [
      `-MapToOpen="${mapName}"`, 
      ...authArgs
    ];

    log.info(`Launching project ${project.id} with map ${mapName} and auth args`);

    const gameProcess = spawn(exePath, args, {
      detached: true,
      cwd: path.dirname(exePath),
      stdio: 'ignore'
    });
    gameProcess.unref();

    return { success: true };
  }

  public async deleteProject(project: Project): Promise<{ success: boolean; message?: string }> {
    try {
      for (const file of project.files) {
        const filePath = path.join(this.paksPath, file.name);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return { success: true };
    } catch (error: any) {
      log.error(`[deleteProject] Silinemedi:`, error);
      const isLocked = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES';
      return {
        success: false,
        message: isLocked
          ? 'Dosya şu an kullanımda. Lütfen oyunu kapatın ve tekrar deneyin.'
          : `Silinemedi: ${error.message}`,
      };
    }
  }

  public clearAllProjects() {
    if (!fs.existsSync(this.paksPath)) return;
    
    const files = fs.readdirSync(this.paksPath);
    for (const file of files) {
      if (!this.protectedFiles.includes(file)) {
        const filePath = path.join(this.paksPath, file);
        try {
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          log.error(`Error deleting file during cleanup: ${file}`, e);
        }
      }
    }
    log.info('Disk cleanup completed (logout/switch).');
  }

  public syncDisk(authorizedProjects: Project[]) {
    if (!fs.existsSync(this.paksPath)) return;

    const authorizedFiles = new Set<string>(this.protectedFiles);
    for (const project of authorizedProjects) {
      for (const file of project.files) {
        authorizedFiles.add(file.name);
      }
    }

    const filesOnDisk = fs.readdirSync(this.paksPath);
    for (const file of filesOnDisk) {
      if (!authorizedFiles.has(file)) {
        const filePath = path.join(this.paksPath, file);
        try {
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            log.info(`Deleted unauthorized project file: ${file}`);
          }
        } catch (e) {
          log.error(`Error deleting unauthorized file: ${file}`, e);
        }
      }
    }
  }
}
