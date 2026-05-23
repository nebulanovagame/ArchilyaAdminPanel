import { app, shell, type BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import chokidar, { type FSWatcher } from 'chokidar';
import Store from 'electron-store';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref as storageRef, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { deleteFileFromProject } from './storageService';
import { createR2UploadUrlSecure, shouldUseR2Upload, uploadFilePathToSignedUrl } from './r2UploadService';
import { clearProjectUploadSignal, upsertProjectUploadSignal } from './uploadSignalService';
import type { ProjectFile, SyncStatus } from '../../shared/types';

interface ManifestFile {
  name: string;
  remoteUrl: string;
  remotePath: string | null;
  localPath: string;
  hash: string;
  baseHash: string;
  size: number;
  lastModified: string;
  lastSyncedRemoteFingerprint: string;
  syncStatus: 'synced' | 'modified' | 'new' | 'deleted';
}

interface SyncManifest {
  projectId: string;
  lastSync: string;
  files: ManifestFile[];
}

interface SyncProject {
  id: string;
  name: string;
  files: ProjectFile[];
  isDeleted?: boolean;
  updatedAt?: {
    toDate?: () => Date;
  } | null;
}

const MANIFEST_FILE = '.archilya-manifest.json';
const CHECKPOINT_SUFFIX = '.part.json';
const PART_SUFFIX = '.part';
const AUTO_SYNC_INTERVAL_MS = 90_000;
const LOCAL_DEBOUNCE_MS = 12_000;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/[\s.]+$/g, '').trim() || 'Project';
}

function getSafeRelativePath(relativePath: string, fallbackName: string): string {
  const rawPath = String(relativePath || '').replace(/\\/g, '/').trim();
  const rawSegments = rawPath.split('/').filter(Boolean);
  const hasUnsafeTraversal = rawPath.startsWith('/')
    || /^[A-Za-z]:/.test(rawPath)
    || rawSegments.some((segment) => segment === '.' || segment === '..');

  const sourceSegments = hasUnsafeTraversal ? [fallbackName] : rawSegments;
  const sanitizedSegments = sourceSegments.map((segment) => safeName(segment)).filter(Boolean);
  return sanitizedSegments.join('/') || safeName(fallbackName) || 'Project File';
}

function resolveProjectAbsolutePath(projectPath: string, relativePath: string): string {
  const rootPath = path.resolve(projectPath);
  const absolutePath = path.resolve(rootPath, relativePath);
  const relativeToRoot = path.relative(rootPath, absolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('Gecersiz proje dosya yolu.');
  }

  return absolutePath;
}

function getTypeKey(ext: string): 'pdf' | 'dwg' | 'img' {
  if (ext === 'pdf') return 'pdf';
  if (ext === 'dwg' || ext === 'dxf') return 'dwg';
  return 'img';
}

function remoteFingerprint(file: ProjectFile): string {
  return [file.path || '', file.url || '', file.size || 0, file.createdAt || '', file.status || 'active'].join('|');
}

function projectFingerprint(project: SyncProject): string {
  const files = (project.files || [])
    .filter((file) => file.status !== 'trashed')
    .map((file) => `${file.path}|${file.size}|${file.createdAt}|${file.status || 'active'}`)
    .sort()
    .join(';');

  const updatedAt = project.updatedAt?.toDate?.()?.toISOString?.() || '';
  return `${updatedAt}|${files.length}|${files}`;
}

export class SyncService {
  private win: BrowserWindow;
  private store = new Store();
  private statuses = new Map<string, SyncStatus>();
  private pendingChanges = new Map<string, number>();
  private watchers = new Map<string, FSWatcher>();
  private syncingProjects = new Set<string>();
  private queuedSyncs = new Set<string>();
  private localDebounceTimers = new Map<string, NodeJS.Timeout>();
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private remoteUnsubscribe: Unsubscribe | null = null;
  private remoteFingerprintByProject = new Map<string, string>();

  constructor(win: BrowserWindow) {
    this.win = win;
    this.ensureSyncRoot();
    this.startAutoSync();
    this.win.on('focus', () => {
      void this.handleAppFocus();
    });
  }

  public getSyncRoot(): string {
    const configured = this.store.get('sync.rootFolder') as string | undefined;
    if (configured && configured.trim()) {
      return configured;
    }
    return path.join(app.getPath('home'), 'Archilya');
  }

  public setSyncRoot(folderPath: string): string {
    this.store.set('sync.rootFolder', folderPath);
    this.ensureSyncRoot();
    this.requestAllProjectsSync('sync-folder-changed');
    return this.getSyncRoot();
  }

  public async getLocalProjectPath(projectId: string): Promise<string> {
    const project = await this.fetchProject(projectId);
    const projectPath = path.join(this.getSyncRoot(), safeName(project.name || project.id));
    await fs.promises.mkdir(projectPath, { recursive: true });
    return projectPath;
  }

  public async openProjectFolder(projectId: string): Promise<void> {
    const localPath = await this.getLocalProjectPath(projectId);
    await shell.openPath(localPath);
  }

  public getStatus(projectId: string): SyncStatus {
    return this.statuses.get(projectId) || {
      projectId,
      status: 'idle',
      lastSync: '',
      pendingChanges: this.pendingChanges.get(projectId) || 0,
      progress: 0,
      progressBytes: 0,
      totalBytes: 0,
      retryCount: 0,
      isResumable: true,
    };
  }

  public async syncAllProjects(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sync icin once oturum acmalisiniz.');

    this.ensureRemoteWatcher();

    const q = query(collection(db, 'projects'), where('memberUids', 'array-contains', user.uid));
    const snapshot = await getDocs(q);

    for (const projectDoc of snapshot.docs) {
      const data = projectDoc.data() as SyncProject;
      if (data?.isDeleted) continue;
      await this.syncProject(projectDoc.id);
    }
  }

  public async syncProject(projectId: string): Promise<void> {
    if (this.syncingProjects.has(projectId)) {
      this.queuedSyncs.add(projectId);
      return;
    }

    this.syncingProjects.add(projectId);
    this.updateStatus(projectId, {
      status: 'syncing',
      progress: 0,
      progressBytes: 0,
      totalBytes: 0,
      retryCount: 0,
      isResumable: true,
    });

    try {
      await this.runSyncCycle(projectId);
    } catch (error) {
      this.updateStatus(projectId, {
        status: 'error',
        lastSync: nowIso(),
        progress: 0,
      });
      throw error;
    } finally {
      this.syncingProjects.delete(projectId);
      if (this.queuedSyncs.has(projectId)) {
        this.queuedSyncs.delete(projectId);
        void this.syncProject(projectId);
      }
    }
  }

  public async handleNetworkOnline(): Promise<void> {
    this.requestAllProjectsSync('network-online');
  }

  public async handleAppFocus(): Promise<void> {
    this.requestAllProjectsSync('app-focus');
  }

  public stop(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    if (this.remoteUnsubscribe) {
      this.remoteUnsubscribe();
      this.remoteUnsubscribe = null;
    }

    for (const timer of this.localDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.localDebounceTimers.clear();

    for (const watcher of this.watchers.values()) {
      watcher.close().catch(() => undefined);
    }
    this.watchers.clear();
  }

  private startAutoSync(): void {
    this.autoSyncTimer = setInterval(() => {
      this.requestAllProjectsSync('auto-interval');
    }, AUTO_SYNC_INTERVAL_MS);
  }

  private requestAllProjectsSync(reason: string): void {
    void reason;
    if (!auth.currentUser) return;
    void this.syncAllProjects().catch(() => undefined);
  }

  private ensureSyncRoot(): void {
    const root = this.getSyncRoot();
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
  }

  private ensureRemoteWatcher(): void {
    if (this.remoteUnsubscribe || !auth.currentUser) {
      return;
    }

    const user = auth.currentUser;
    const q = query(collection(db, 'projects'), where('memberUids', 'array-contains', user.uid));
    let initialized = false;

    this.remoteUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const projectId = change.doc.id;
        const data = change.doc.data() as SyncProject;
        if (data?.isDeleted) return;

        const fp = projectFingerprint(data);
        const prev = this.remoteFingerprintByProject.get(projectId);
        this.remoteFingerprintByProject.set(projectId, fp);

        if (!initialized) {
          return;
        }

        if (change.type === 'added' || (prev && prev !== fp)) {
          void this.syncProject(projectId).catch(() => undefined);
        }
      });

      initialized = true;
    });
  }

  private async runSyncCycle(projectId: string): Promise<void> {
    const project = await this.fetchProject(projectId);
    const projectPath = await this.getLocalProjectPath(projectId);
    const manifestPath = path.join(projectPath, MANIFEST_FILE);
    const manifest = await this.readManifest(manifestPath, projectId);

    const remoteByLocalPath = new Map<string, ProjectFile>();
    for (const remoteFile of project.files || []) {
      const localPath = this.resolveLocalPath(projectId, remoteFile);
      remoteByLocalPath.set(localPath, remoteFile);
    }

    const manifestByLocalPath = new Map(manifest.files.map((f) => [f.localPath, f]));
    const localFiles = await this.listLocalFiles(projectPath);
    const localSet = new Set(localFiles);

    const totalBytes = (project.files || []).reduce((sum, f) => sum + (f.size || 0), 0);
    let transferredBytes = 0;

    for (const [localRelPath, remoteFile] of remoteByLocalPath.entries()) {
      const localAbsPath = resolveProjectAbsolutePath(projectPath, localRelPath);
      const prev = manifestByLocalPath.get(localRelPath);
      const remoteFp = remoteFingerprint(remoteFile);
      const existsLocal = localSet.has(localRelPath);

      let localChanged = false;
      if (existsLocal && prev) {
        const localHash = await this.computeFileHash(localAbsPath);
        localChanged = localHash !== prev.baseHash;
      } else if (existsLocal && !prev) {
        localChanged = true;
      }

      const remoteChanged = !prev || prev.lastSyncedRemoteFingerprint !== remoteFp;

      if (existsLocal && localChanged && remoteChanged && prev) {
        const conflictCopyPath = await this.createConflictCopy(localAbsPath);
        this.emitFileChanged(projectId, toPosix(path.relative(projectPath, conflictCopyPath)), 'conflict');
        await this.downloadFileResumable(projectId, remoteFile, localAbsPath, totalBytes, transferredBytes);
      } else if (!existsLocal || remoteChanged) {
        await this.downloadFileResumable(projectId, remoteFile, localAbsPath, totalBytes, transferredBytes);
      }

      transferredBytes += remoteFile.size || 0;
    }

    for (const manifestFile of manifest.files) {
      const stillRemote = remoteByLocalPath.has(manifestFile.localPath);
      if (stillRemote) continue;

      const localAbsPath = resolveProjectAbsolutePath(projectPath, manifestFile.localPath);
      if (fs.existsSync(localAbsPath)) {
        await fs.promises.unlink(localAbsPath);
        this.emitFileChanged(projectId, manifestFile.localPath, 'delete');
      }
    }

    const updatedProjectAfterDownload = await this.fetchProject(projectId);
    const latestRemoteByLocalPath = new Map<string, ProjectFile>();
    for (const remoteFile of updatedProjectAfterDownload.files || []) {
      latestRemoteByLocalPath.set(this.resolveLocalPath(projectId, remoteFile), remoteFile);
    }

    const latestLocalFiles = await this.listLocalFiles(projectPath);
    const latestLocalSet = new Set(latestLocalFiles);

    for (const localRelPath of latestLocalFiles) {
      const localAbsPath = resolveProjectAbsolutePath(projectPath, localRelPath);
      const remoteFile = latestRemoteByLocalPath.get(localRelPath);
      const prev = manifestByLocalPath.get(localRelPath);

      if (!remoteFile) {
        await this.uploadLocalFile(projectId, localRelPath, localAbsPath, null);
        continue;
      }

      if (prev) {
        const hash = await this.computeFileHash(localAbsPath);
        if (hash !== prev.hash) {
          await this.uploadLocalFile(projectId, localRelPath, localAbsPath, remoteFile);
        }
      }
    }

    for (const [localRelPath, remoteFile] of latestRemoteByLocalPath.entries()) {
      if (!latestLocalSet.has(localRelPath) && manifestByLocalPath.has(localRelPath)) {
        await deleteFileFromProject(projectId, remoteFile);
        this.emitFileChanged(projectId, localRelPath, 'delete');
      }
    }

    const finalProject = await this.fetchProject(projectId);
    const finalManifest = await this.buildManifest(projectId, projectPath, finalProject.files || []);
    await fs.promises.writeFile(manifestPath, JSON.stringify(finalManifest, null, 2), 'utf-8');

    this.pendingChanges.set(projectId, 0);
    this.updateStatus(projectId, {
      status: 'up-to-date',
      lastSync: nowIso(),
      pendingChanges: 0,
      progress: 100,
    });

    this.watchProject(projectId, projectPath);
  }

  private async fetchProject(projectId: string): Promise<SyncProject> {
    const projectDoc = await getDoc(doc(db, 'projects', projectId));
    if (!projectDoc.exists()) {
      throw new Error(`Proje bulunamadi: ${projectId}`);
    }
    const data = projectDoc.data() as SyncProject;
    const activeFiles = ((data.files || []) as ProjectFile[])
      .filter((file) => file.status !== 'trashed');

    return {
      id: projectDoc.id,
      name: data.name || projectDoc.id,
      files: activeFiles,
      isDeleted: data.isDeleted,
      updatedAt: data.updatedAt,
    };
  }

  private async readManifest(manifestPath: string, projectId: string): Promise<SyncManifest> {
    if (!fs.existsSync(manifestPath)) {
      return {
        projectId,
        lastSync: '',
        files: [],
      };
    }
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw) as SyncManifest;
      return {
        ...parsed,
        projectId,
        files: parsed.files || [],
      };
    } catch {
      return {
        projectId,
        lastSync: '',
        files: [],
      };
    }
  }

  private resolveLocalPath(projectId: string, file: ProjectFile): string {
    const normalizedRemotePath = (file.path || '').replace(/\\/g, '/');
    const marker = `/projects/${projectId}/`;
    const markerIndex = normalizedRemotePath.indexOf(marker);

    let relative = file.name;
    if (markerIndex >= 0) {
      relative = normalizedRemotePath.slice(markerIndex + marker.length) || file.name;
    } else if (normalizedRemotePath) {
      const segments = normalizedRemotePath.split('/');
      relative = segments[segments.length - 1] || file.name;
    }

    relative = relative.replace(/^\d{10,}_/, '');
    return getSafeRelativePath(relative, file.name || 'Project File');
  }

  private async listLocalFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === MANIFEST_FILE) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.name.endsWith(PART_SUFFIX) || entry.name.endsWith(CHECKPOINT_SUFFIX)) continue;
        if (entry.name.endsWith('.tmp') || entry.name.endsWith('.bak')) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          continue;
        }
        if (entry.isFile()) {
          files.push(toPosix(path.relative(projectPath, fullPath)));
        }
      }
    };

    await walk(projectPath);
    return files;
  }

  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async createConflictCopy(localAbsPath: string): Promise<string> {
    const parsed = path.parse(localAbsPath);
    const stamp = new Date().toISOString().replace('T', ' ').replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(parsed.dir, `${parsed.name} (Conflict Copy ${stamp})${parsed.ext}`);
    await fs.promises.rename(localAbsPath, backupPath);
    return backupPath;
  }

  private async downloadFileResumable(
    projectId: string,
    file: ProjectFile,
    destinationPath: string,
    totalBytes: number,
    alreadyTransferred: number,
  ): Promise<void> {
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });

    const partPath = `${destinationPath}${PART_SUFFIX}`;
    const checkpointPath = `${destinationPath}${CHECKPOINT_SUFFIX}`;

    let offset = 0;
    if (fs.existsSync(partPath)) {
      offset = (await fs.promises.stat(partPath)).size;
    }
    if (fs.existsSync(checkpointPath)) {
      try {
        const checkpointRaw = await fs.promises.readFile(checkpointPath, 'utf-8');
        const checkpoint = JSON.parse(checkpointRaw) as { offset?: number };
        offset = Math.max(offset, checkpoint.offset || 0);
      } catch {
        offset = 0;
      }
    }

    let retryCount = 0;
    const maxRetries = 5;
    const expectedSize = file.size || 0;
    let downloaded = offset;

    while (expectedSize === 0 || downloaded < expectedSize) {
      try {
        const headers: Record<string, string> = {};
        if (downloaded > 0) {
          headers.Range = `bytes=${downloaded}-`;
        }

        const response = await axios.get(file.url, {
          responseType: 'stream',
          headers,
          timeout: 30000,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        if (downloaded > 0 && response.status === 200) {
          downloaded = 0;
          await fs.promises.writeFile(partPath, Buffer.alloc(0));
        }

        await new Promise<void>((resolve, reject) => {
          const writer = fs.createWriteStream(partPath, { flags: 'a' });
          let lastCheckpoint = downloaded;

          response.data.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            const transferred = alreadyTransferred + downloaded;
            const progress = totalBytes > 0 ? Math.min(Math.round((transferred / totalBytes) * 100), 99) : 0;
            this.updateStatus(projectId, {
              status: 'syncing',
              progress,
              progressBytes: transferred,
              totalBytes,
              currentFile: file.name,
              retryCount,
              isResumable: true,
            });

            if (downloaded - lastCheckpoint >= 1024 * 1024) {
              lastCheckpoint = downloaded;
              fs.writeFileSync(checkpointPath, JSON.stringify({ offset: downloaded }), 'utf-8');
            }
          });

          response.data.on('error', reject);
          writer.on('error', reject);
          writer.on('finish', resolve);
          response.data.pipe(writer);
        });

        await fs.promises.writeFile(checkpointPath, JSON.stringify({ offset: downloaded }), 'utf-8');

        if (expectedSize === 0) {
          break;
        }
      } catch (error) {
        retryCount += 1;
        this.updateStatus(projectId, { retryCount });
        if (retryCount > maxRetries) {
          throw error;
        }
        await delay(Math.min(1000 * 2 ** retryCount, 10000));
      }
    }

    if (expectedSize > 0 && downloaded !== expectedSize) {
      throw new Error(`Eksik indirme: ${file.name}`);
    }

    if (fs.existsSync(destinationPath)) {
      await fs.promises.unlink(destinationPath);
    }
    await fs.promises.rename(partPath, destinationPath);
    if (fs.existsSync(checkpointPath)) {
      await fs.promises.unlink(checkpointPath);
    }
    this.emitFileChanged(projectId, file.name, 'download');
  }

  private async waitUntilStable(filePath: string, minStableMs = 1200, retries = 5): Promise<void> {
    let prevSize = -1;
    let prevMtime = 0;

    for (let i = 0; i < retries; i += 1) {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const statA = await fs.promises.stat(filePath);
      await delay(minStableMs);
      const statB = await fs.promises.stat(filePath);

      if (statA.size === statB.size && statA.mtimeMs === statB.mtimeMs && statB.size === prevSize && statB.mtimeMs === prevMtime) {
        return;
      }

      prevSize = statB.size;
      prevMtime = statB.mtimeMs;
    }
  }

  private async uploadLocalFile(
    projectId: string,
    localRelPath: string,
    localAbsPath: string,
    replacingRemoteFile: ProjectFile | null,
  ): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Upload icin once oturum acmalisiniz.');
    }

    await this.waitUntilStable(localAbsPath);

    if (replacingRemoteFile) {
      await deleteFileFromProject(projectId, replacingRemoteFile);
    }

    const ext = path.extname(localAbsPath).replace('.', '').toLowerCase();
    const fileName = path.basename(localRelPath);
    const contentType = ext === 'pdf'
      ? 'application/pdf'
      : ['dwg', 'dxf'].includes(ext)
        ? 'application/octet-stream'
        : `image/${ext === 'jpg' ? 'jpeg' : ext || 'jpeg'}`;
    const signalId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const stats = await fs.promises.stat(localAbsPath);
    const fileSize = stats.size;
    const useR2 = shouldUseR2Upload({ fileName, fileSize, contentType });

    await upsertProjectUploadSignal({
      id: signalId,
      userId: user.uid,
      projectId,
      name: fileName,
      size: fileSize,
      contentType,
      folderId: null,
      storageProvider: useR2 ? 'r2' : 'firebase',
      status: 'uploading',
    }).catch(() => null);

    if (useR2) {
      try {
        const uploadMeta = await createR2UploadUrlSecure({
          projectId,
          fileName,
          fileSize,
          contentType,
        });

        if (!uploadMeta?.success || !uploadMeta?.uploadUrl || !uploadMeta?.objectKey) {
          throw new Error('R2 upload URL olusturulamadi.');
        }

        await uploadFilePathToSignedUrl(uploadMeta.uploadUrl, localAbsPath, contentType, uploadMeta.pseudoUrl);
        const typeKey = getTypeKey(ext);
        const pseudoUrl = String(uploadMeta.pseudoUrl || `r2://${uploadMeta.objectKey}`).trim();

        await updateDoc(doc(db, 'projects', projectId), {
          files: arrayUnion({
            name: fileName,
            url: pseudoUrl,
            path: null,
            size: fileSize,
            type: ext,
            storageProvider: 'r2',
            objectKey: String(uploadMeta.objectKey || '').trim() || null,
            contentType,
            folderId: null,
            createdAt: nowIso(),
            uploadedBy: user.displayName || user.email || user.uid,
            status: 'active',
          }),
          [`fileCount.${typeKey}`]: increment(1),
          totalSize: increment(fileSize),
          updatedAt: serverTimestamp(),
        });

        await clearProjectUploadSignal(projectId, signalId).catch(() => null);
        this.emitFileChanged(projectId, localRelPath, 'upload');
        return;
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error, 'R2 yukleme hatasi');
        await upsertProjectUploadSignal({
          id: signalId,
          userId: user.uid,
          projectId,
          name: fileName,
          size: fileSize,
          contentType,
          folderId: null,
          storageProvider: 'r2',
          status: 'failed',
          lastError: errorMessage,
        }).catch(() => null);
        throw new Error(errorMessage);
      }
    }

    const fileBuffer = await fs.promises.readFile(localAbsPath);
    const storagePath = `users/${user.uid}/projects/${projectId}/${localRelPath}`.replace(/\\/g, '/');

    const sRef = storageRef(storage, storagePath);
    const task = uploadBytesResumable(sRef, new Uint8Array(fileBuffer));

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          const percent = snapshot.totalBytes > 0
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          this.updateStatus(projectId, {
            status: 'syncing',
            progress: percent,
            currentFile: fileName,
            isResumable: true,
          });
        },
        async (error) => {
          await upsertProjectUploadSignal({
            id: signalId,
            userId: user.uid,
            projectId,
            name: fileName,
            size: fileSize,
            contentType,
            folderId: null,
            storageProvider: 'firebase',
            status: 'failed',
            lastError: error?.message || 'Firebase yukleme hatasi',
          }).catch(() => null);
          reject(error);
        },
        () => resolve(),
      );
    });

    const url = await getDownloadURL(task.snapshot.ref);

    await updateDoc(doc(db, 'projects', projectId), {
      files: arrayUnion({
        name: fileName,
        url,
        path: storagePath,
        size: fileSize,
        type: ext,
        storageProvider: 'firebase',
        objectKey: null,
        contentType,
        folderId: null,
        createdAt: nowIso(),
        uploadedBy: user.displayName || user.email || user.uid,
        status: 'active',
      }),
      [`fileCount.${getTypeKey(ext)}`]: increment(1),
      totalSize: increment(fileSize),
      updatedAt: serverTimestamp(),
    });

    await clearProjectUploadSignal(projectId, signalId).catch(() => null);
    this.emitFileChanged(projectId, localRelPath, 'upload');
  }

  private async buildManifest(projectId: string, projectPath: string, files: ProjectFile[]): Promise<SyncManifest> {
    const entries: ManifestFile[] = [];

    for (const file of files) {
      const localPath = this.resolveLocalPath(projectId, file);
      const localAbs = resolveProjectAbsolutePath(projectPath, localPath);
      if (!fs.existsSync(localAbs)) continue;

      const stats = await fs.promises.stat(localAbs);
      const hash = await this.computeFileHash(localAbs);

      entries.push({
        name: file.name,
        remoteUrl: file.url,
        remotePath: file.path,
        localPath,
        hash,
        baseHash: hash,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        lastSyncedRemoteFingerprint: remoteFingerprint(file),
        syncStatus: 'synced',
      });
    }

    return {
      projectId,
      lastSync: nowIso(),
      files: entries,
    };
  }

  private watchProject(projectId: string, projectPath: string): void {
    const existing = this.watchers.get(projectId);
    if (existing) {
      existing.close().catch(() => undefined);
      this.watchers.delete(projectId);
    }

    const watcher = chokidar.watch(projectPath, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    const handle = (action: string, filePath: string) => {
      if (this.syncingProjects.has(projectId)) return;
      const relative = toPosix(path.relative(projectPath, filePath));
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return;
      }
      const nextPending = (this.pendingChanges.get(projectId) || 0) + 1;
      this.pendingChanges.set(projectId, nextPending);
      this.updateStatus(projectId, {
        status: 'idle',
        pendingChanges: nextPending,
      });
      this.emitFileChanged(projectId, relative, action);

      const prevTimer = this.localDebounceTimers.get(projectId);
      if (prevTimer) {
        clearTimeout(prevTimer);
      }

      const timer = setTimeout(() => {
        this.localDebounceTimers.delete(projectId);
        void this.syncProject(projectId).catch(() => undefined);
      }, LOCAL_DEBOUNCE_MS);
      this.localDebounceTimers.set(projectId, timer);
    };

    watcher.on('add', (filePath: string) => handle('add', filePath));
    watcher.on('change', (filePath: string) => handle('change', filePath));
    watcher.on('unlink', (filePath: string) => handle('delete', filePath));

    this.watchers.set(projectId, watcher);
  }

  private updateStatus(projectId: string, patch: Partial<SyncStatus>): void {
    const current = this.getStatus(projectId);
    const next: SyncStatus = {
      ...current,
      ...patch,
      projectId,
      pendingChanges: patch.pendingChanges ?? this.pendingChanges.get(projectId) ?? current.pendingChanges,
      lastSync: patch.lastSync ?? current.lastSync,
    };
    this.statuses.set(projectId, next);
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('sync:progress', next);
    }
  }

  private emitFileChanged(projectId: string, file: string, action: string): void {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('sync:fileChanged', { projectId, file, action });
    }
  }
}
