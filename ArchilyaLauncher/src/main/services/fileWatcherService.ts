import path from 'path';
import fs from 'fs';
import chokidar, { type FSWatcher } from 'chokidar';
import type { BrowserWindow } from 'electron';
import type { FsItem, FsListResponse, FsWatchEvent, FsWatchEventType, FileLockEvent } from '../../shared/fsTypes';
import { uploadFileToProject } from './storageService';
import log from 'electron-log';

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
function shouldIgnoreFile(fileName: string): boolean {
  // Tam isim eşleşmesi
  if (IGNORED_NAMES.has(fileName)) return true;

  // Uzantı kontrolü
  const lower = fileName.toLowerCase();
  for (const ext of IGNORED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }

  // Office geçici dosya öneki (~$Dosya.docx)
  if (lower.startsWith('~$')) return true;

  return false;
}

/** Dosya bir AutoCAD kilit dosyası mı? */
function isCadLockFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  for (const ext of CAD_LOCK_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/** Kilit dosyasından asıl dosya adını çıkar (Zemin_Kat.dwl → Zemin_Kat.dwg) */
function getLockedFileName(lockFileName: string): string {
  // .dwl, .dwl2, .dwl3 uzantılarını .dwg ile değiştir
  return lockFileName.replace(/\.dwl2?3?$/i, '.dwg');
}

// ── Servis Sınıfı ──────────────────────────────────────────

class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private win: BrowserWindow | null = null;
  private watchedPath: string | null = null;
  private projectId: string | null = null;

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  setProjectId(projectId: string | null): void {
    this.projectId = projectId;
  }

  // ── Klasör içeriği listele ────────────────────────────────

  async listDirectory(directoryPath: string): Promise<FsListResponse> {
    try {
      const resolved = path.resolve(directoryPath);
      if (!fs.existsSync(resolved)) {
        return { success: false, items: [], error: 'Klasör bulunamadı.' };
      }
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return { success: false, items: [], error: 'Belirtilen yol bir klasör değil.' };
      }

      const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
      const items: FsItem[] = [];

      for (const entry of entries) {
        // FAZ 2.3: Çöp ve yedek dosyaları atla
        if (!entry.isDirectory() && shouldIgnoreFile(entry.name)) {
          continue;
        }

        const absolutePath = path.join(resolved, entry.name);
        const entryStat = fs.statSync(absolutePath);
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
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return { success: true, items };
    } catch (err: any) {
      log.error('[FileWatcherService] listDirectory error:', err);
      return { success: false, items: [], error: err.message || 'Klasör listelenemedi.' };
    }
  }

  // ── İzlemeyi başlat ───────────────────────────────────────

  async startWatching(directoryPath: string, projectId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const resolved = path.resolve(directoryPath);
      if (!fs.existsSync(resolved)) {
        return { success: false, error: 'Klasör bulunamadı.' };
      }
      const stat = fs.statSync(resolved);
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
      this.watcher = chokidar.watch(resolved, {
        ignored: /(^|[/\\])\../, // gizli dosyaları atla
        persistent: true,
        ignoreInitial: true,
        depth: 0,
      });

      const handleEvent = (eventType: FsWatchEventType, filePath: string) => {
        const fileName = path.basename(filePath);
        const relativePath = path.relative(resolved, filePath);

        // ── FAZ 2.3: AutoCAD kilit dosyası istihbaratı ─────
        if (isCadLockFile(fileName)) {
          const lockedFileName = getLockedFileName(fileName);
          const lockedFilePath = path.join(resolved, lockedFileName);

          if (eventType === 'add') {
            // Kilit dosyası oluştu → asıl dosya kilitlendi
            const lockEvent: FileLockEvent = {
              relativePath: lockedFileName,
              absolutePath: lockedFilePath,
              status: 'locked',
              lockedBy: process.env.USERNAME || process.env.USER || 'Bilinmeyen Kullanici',
            };
            this.emitLockEvent(lockEvent);
            log.info(`[FileWatcherService] 🔒 Kilit: ${lockedFileName} (${lockEvent.lockedBy})`);
          } else if (eventType === 'unlink') {
            // Kilit dosyası silindi → asıl dosya serbest
            const unlockEvent: FileLockEvent = {
              relativePath: lockedFileName,
              absolutePath: lockedFilePath,
              status: 'unlocked',
            };
            this.emitLockEvent(unlockEvent);
            log.info(`[FileWatcherService] 🔓 Kilit kaldırıldı: ${lockedFileName}`);
          }
          // Kilit dosyaları kendileri fs:changed olarak gönderilmez
          return;
        }

        // ── FAZ 2.3: Çöp/yedek filtreleme ──────────────────
        if (shouldIgnoreFile(fileName)) {
          return; // sessizce atla
        }

        const isDirectory = fs.existsSync(filePath) ? fs.statSync(filePath).isDirectory() : false;

        // ── FAZ 2.4: Otomatik yükleme (add/change) ─────────
        if (!isDirectory && (eventType === 'add' || eventType === 'change') && this.projectId && this.win) {
          log.info(`[FileWatcherService] ☁️ Yükleme başlatılıyor: ${fileName} → ${this.projectId}`);
          // Asenkron yükleme — event akışını bloke etme
          uploadFileToProject(filePath, this.projectId, this.win).catch((err) => {
            log.error(`[FileWatcherService] Yükleme hatası (${fileName}):`, err);
          });
        }

        const event: FsWatchEvent = {
          eventType,
          relativePath,
          absolutePath: filePath,
          isDirectory,
        };

        // Eğer dosya hâlâ varsa stats ekle
        if (fs.existsSync(filePath) && !isDirectory) {
          try {
            const s = fs.statSync(filePath);
            event.stats = {
              size: s.size,
              modifiedAt: s.mtime.toISOString(),
            };
          } catch {
            // stats alınamazsa sessizce devam et
          }
        }

        this.emitEvent(event);
        log.info(`[FileWatcherService] ${eventType}: ${relativePath}`);
      };

      this.watcher.on('add', (filePath: string) => handleEvent('add', filePath));
      this.watcher.on('change', (filePath: string) => handleEvent('change', filePath));
      this.watcher.on('unlink', (filePath: string) => handleEvent('unlink', filePath));

      this.watcher.on('error', (error: Error) => {
        log.error('[FileWatcherService] Watcher error:', error);
      });

      log.info(`[FileWatcherService] İzleme başlatıldı: ${resolved}`);
      return { success: true };
    } catch (err: any) {
      log.error('[FileWatcherService] startWatching error:', err);
      return { success: false, error: err.message || 'İzleme başlatılamadı.' };
    }
  }

  // ── İzlemeyi durdur ───────────────────────────────────────

  async stopWatching(directoryPath?: string): Promise<{ success: boolean }> {
    const requestedPath = directoryPath ? path.resolve(directoryPath) : null;
    if (requestedPath && this.watchedPath && requestedPath !== this.watchedPath) {
      return { success: true };
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.watchedPath = null;
      log.info('[FileWatcherService] İzleme durduruldu.');
    }
    return { success: true };
  }

  // ── Event gönderimi ───────────────────────────────────────

  private emitEvent(event: FsWatchEvent): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('fs:changed', event);
  }

  private emitLockEvent(event: FileLockEvent): void {
    if (!this.win || this.win.isDestroyed()) return;
    this.win.webContents.send('fs:lockChanged', event);
  }

  // ── Temizlik ──────────────────────────────────────────────

  async shutdown(): Promise<void> {
    await this.stopWatching();
    this.win = null;
  }
}

export const fileWatcherService = new FileWatcherService();
export default fileWatcherService;
