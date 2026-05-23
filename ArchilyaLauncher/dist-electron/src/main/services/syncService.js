"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const chokidar_1 = __importDefault(require("chokidar"));
const electron_store_1 = __importDefault(require("electron-store"));
const firestore_1 = require("firebase/firestore");
const storage_1 = require("firebase/storage");
const firebase_1 = require("../firebase");
const storageService_1 = require("./storageService");
const r2UploadService_1 = require("./r2UploadService");
const uploadSignalService_1 = require("./uploadSignalService");
const MANIFEST_FILE = '.archilya-manifest.json';
const CHECKPOINT_SUFFIX = '.part.json';
const PART_SUFFIX = '.part';
const AUTO_SYNC_INTERVAL_MS = 90_000;
const LOCAL_DEBOUNCE_MS = 12_000;
function getErrorMessage(error, fallback) {
    return error instanceof Error && error.message ? error.message : fallback;
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function nowIso() {
    return new Date().toISOString();
}
function toPosix(relativePath) {
    return relativePath.split(path_1.default.sep).join('/');
}
function safeName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/[\s.]+$/g, '').trim() || 'Project';
}
function getSafeRelativePath(relativePath, fallbackName) {
    const rawPath = String(relativePath || '').replace(/\\/g, '/').trim();
    const rawSegments = rawPath.split('/').filter(Boolean);
    const hasUnsafeTraversal = rawPath.startsWith('/')
        || /^[A-Za-z]:/.test(rawPath)
        || rawSegments.some((segment) => segment === '.' || segment === '..');
    const sourceSegments = hasUnsafeTraversal ? [fallbackName] : rawSegments;
    const sanitizedSegments = sourceSegments.map((segment) => safeName(segment)).filter(Boolean);
    return sanitizedSegments.join('/') || safeName(fallbackName) || 'Project File';
}
function resolveProjectAbsolutePath(projectPath, relativePath) {
    const rootPath = path_1.default.resolve(projectPath);
    const absolutePath = path_1.default.resolve(rootPath, relativePath);
    const relativeToRoot = path_1.default.relative(rootPath, absolutePath);
    if (relativeToRoot.startsWith('..') || path_1.default.isAbsolute(relativeToRoot)) {
        throw new Error('Gecersiz proje dosya yolu.');
    }
    return absolutePath;
}
function getTypeKey(ext) {
    if (ext === 'pdf')
        return 'pdf';
    if (ext === 'dwg' || ext === 'dxf')
        return 'dwg';
    return 'img';
}
function remoteFingerprint(file) {
    return [file.path || '', file.url || '', file.size || 0, file.createdAt || '', file.status || 'active'].join('|');
}
function projectFingerprint(project) {
    const files = (project.files || [])
        .filter((file) => file.status !== 'trashed')
        .map((file) => `${file.path}|${file.size}|${file.createdAt}|${file.status || 'active'}`)
        .sort()
        .join(';');
    const updatedAt = project.updatedAt?.toDate?.()?.toISOString?.() || '';
    return `${updatedAt}|${files.length}|${files}`;
}
class SyncService {
    win;
    store = new electron_store_1.default();
    statuses = new Map();
    pendingChanges = new Map();
    watchers = new Map();
    syncingProjects = new Set();
    queuedSyncs = new Set();
    localDebounceTimers = new Map();
    autoSyncTimer = null;
    remoteUnsubscribe = null;
    remoteFingerprintByProject = new Map();
    constructor(win) {
        this.win = win;
        this.ensureSyncRoot();
        this.startAutoSync();
        this.win.on('focus', () => {
            void this.handleAppFocus();
        });
    }
    getSyncRoot() {
        const configured = this.store.get('sync.rootFolder');
        if (configured && configured.trim()) {
            return configured;
        }
        return path_1.default.join(electron_1.app.getPath('home'), 'Archilya');
    }
    setSyncRoot(folderPath) {
        this.store.set('sync.rootFolder', folderPath);
        this.ensureSyncRoot();
        this.requestAllProjectsSync('sync-folder-changed');
        return this.getSyncRoot();
    }
    async getLocalProjectPath(projectId) {
        const project = await this.fetchProject(projectId);
        const projectPath = path_1.default.join(this.getSyncRoot(), safeName(project.name || project.id));
        await fs_1.default.promises.mkdir(projectPath, { recursive: true });
        return projectPath;
    }
    async openProjectFolder(projectId) {
        const localPath = await this.getLocalProjectPath(projectId);
        await electron_1.shell.openPath(localPath);
    }
    getStatus(projectId) {
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
    async syncAllProjects() {
        const user = firebase_1.auth.currentUser;
        if (!user)
            throw new Error('Sync icin once oturum acmalisiniz.');
        this.ensureRemoteWatcher();
        const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'projects'), (0, firestore_1.where)('memberUids', 'array-contains', user.uid));
        const snapshot = await (0, firestore_1.getDocs)(q);
        for (const projectDoc of snapshot.docs) {
            const data = projectDoc.data();
            if (data?.isDeleted)
                continue;
            await this.syncProject(projectDoc.id);
        }
    }
    async syncProject(projectId) {
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
        }
        catch (error) {
            this.updateStatus(projectId, {
                status: 'error',
                lastSync: nowIso(),
                progress: 0,
            });
            throw error;
        }
        finally {
            this.syncingProjects.delete(projectId);
            if (this.queuedSyncs.has(projectId)) {
                this.queuedSyncs.delete(projectId);
                void this.syncProject(projectId);
            }
        }
    }
    async handleNetworkOnline() {
        this.requestAllProjectsSync('network-online');
    }
    async handleAppFocus() {
        this.requestAllProjectsSync('app-focus');
    }
    stop() {
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
    startAutoSync() {
        this.autoSyncTimer = setInterval(() => {
            this.requestAllProjectsSync('auto-interval');
        }, AUTO_SYNC_INTERVAL_MS);
    }
    requestAllProjectsSync(reason) {
        void reason;
        if (!firebase_1.auth.currentUser)
            return;
        void this.syncAllProjects().catch(() => undefined);
    }
    ensureSyncRoot() {
        const root = this.getSyncRoot();
        if (!fs_1.default.existsSync(root)) {
            fs_1.default.mkdirSync(root, { recursive: true });
        }
    }
    ensureRemoteWatcher() {
        if (this.remoteUnsubscribe || !firebase_1.auth.currentUser) {
            return;
        }
        const user = firebase_1.auth.currentUser;
        const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'projects'), (0, firestore_1.where)('memberUids', 'array-contains', user.uid));
        let initialized = false;
        this.remoteUnsubscribe = (0, firestore_1.onSnapshot)(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const projectId = change.doc.id;
                const data = change.doc.data();
                if (data?.isDeleted)
                    return;
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
    async runSyncCycle(projectId) {
        const project = await this.fetchProject(projectId);
        const projectPath = await this.getLocalProjectPath(projectId);
        const manifestPath = path_1.default.join(projectPath, MANIFEST_FILE);
        const manifest = await this.readManifest(manifestPath, projectId);
        const remoteByLocalPath = new Map();
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
            }
            else if (existsLocal && !prev) {
                localChanged = true;
            }
            const remoteChanged = !prev || prev.lastSyncedRemoteFingerprint !== remoteFp;
            if (existsLocal && localChanged && remoteChanged && prev) {
                const conflictCopyPath = await this.createConflictCopy(localAbsPath);
                this.emitFileChanged(projectId, toPosix(path_1.default.relative(projectPath, conflictCopyPath)), 'conflict');
                await this.downloadFileResumable(projectId, remoteFile, localAbsPath, totalBytes, transferredBytes);
            }
            else if (!existsLocal || remoteChanged) {
                await this.downloadFileResumable(projectId, remoteFile, localAbsPath, totalBytes, transferredBytes);
            }
            transferredBytes += remoteFile.size || 0;
        }
        for (const manifestFile of manifest.files) {
            const stillRemote = remoteByLocalPath.has(manifestFile.localPath);
            if (stillRemote)
                continue;
            const localAbsPath = resolveProjectAbsolutePath(projectPath, manifestFile.localPath);
            if (fs_1.default.existsSync(localAbsPath)) {
                await fs_1.default.promises.unlink(localAbsPath);
                this.emitFileChanged(projectId, manifestFile.localPath, 'delete');
            }
        }
        const updatedProjectAfterDownload = await this.fetchProject(projectId);
        const latestRemoteByLocalPath = new Map();
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
                await (0, storageService_1.deleteFileFromProject)(projectId, remoteFile);
                this.emitFileChanged(projectId, localRelPath, 'delete');
            }
        }
        const finalProject = await this.fetchProject(projectId);
        const finalManifest = await this.buildManifest(projectId, projectPath, finalProject.files || []);
        await fs_1.default.promises.writeFile(manifestPath, JSON.stringify(finalManifest, null, 2), 'utf-8');
        this.pendingChanges.set(projectId, 0);
        this.updateStatus(projectId, {
            status: 'up-to-date',
            lastSync: nowIso(),
            pendingChanges: 0,
            progress: 100,
        });
        this.watchProject(projectId, projectPath);
    }
    async fetchProject(projectId) {
        const projectDoc = await (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId));
        if (!projectDoc.exists()) {
            throw new Error(`Proje bulunamadi: ${projectId}`);
        }
        const data = projectDoc.data();
        const activeFiles = (data.files || [])
            .filter((file) => file.status !== 'trashed');
        return {
            id: projectDoc.id,
            name: data.name || projectDoc.id,
            files: activeFiles,
            isDeleted: data.isDeleted,
            updatedAt: data.updatedAt,
        };
    }
    async readManifest(manifestPath, projectId) {
        if (!fs_1.default.existsSync(manifestPath)) {
            return {
                projectId,
                lastSync: '',
                files: [],
            };
        }
        try {
            const raw = await fs_1.default.promises.readFile(manifestPath, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                ...parsed,
                projectId,
                files: parsed.files || [],
            };
        }
        catch {
            return {
                projectId,
                lastSync: '',
                files: [],
            };
        }
    }
    resolveLocalPath(projectId, file) {
        const normalizedRemotePath = (file.path || '').replace(/\\/g, '/');
        const marker = `/projects/${projectId}/`;
        const markerIndex = normalizedRemotePath.indexOf(marker);
        let relative = file.name;
        if (markerIndex >= 0) {
            relative = normalizedRemotePath.slice(markerIndex + marker.length) || file.name;
        }
        else if (normalizedRemotePath) {
            const segments = normalizedRemotePath.split('/');
            relative = segments[segments.length - 1] || file.name;
        }
        relative = relative.replace(/^\d{10,}_/, '');
        return getSafeRelativePath(relative, file.name || 'Project File');
    }
    async listLocalFiles(projectPath) {
        const files = [];
        const walk = async (dir) => {
            const entries = await fs_1.default.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === MANIFEST_FILE)
                    continue;
                if (entry.name.startsWith('.'))
                    continue;
                if (entry.name.endsWith(PART_SUFFIX) || entry.name.endsWith(CHECKPOINT_SUFFIX))
                    continue;
                if (entry.name.endsWith('.tmp') || entry.name.endsWith('.bak'))
                    continue;
                const fullPath = path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }
                if (entry.isFile()) {
                    files.push(toPosix(path_1.default.relative(projectPath, fullPath)));
                }
            }
        };
        await walk(projectPath);
        return files;
    }
    async computeFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('sha256');
            const stream = fs_1.default.createReadStream(filePath);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    async createConflictCopy(localAbsPath) {
        const parsed = path_1.default.parse(localAbsPath);
        const stamp = new Date().toISOString().replace('T', ' ').replace(/:/g, '-').split('.')[0];
        const backupPath = path_1.default.join(parsed.dir, `${parsed.name} (Conflict Copy ${stamp})${parsed.ext}`);
        await fs_1.default.promises.rename(localAbsPath, backupPath);
        return backupPath;
    }
    async downloadFileResumable(projectId, file, destinationPath, totalBytes, alreadyTransferred) {
        await fs_1.default.promises.mkdir(path_1.default.dirname(destinationPath), { recursive: true });
        const partPath = `${destinationPath}${PART_SUFFIX}`;
        const checkpointPath = `${destinationPath}${CHECKPOINT_SUFFIX}`;
        let offset = 0;
        if (fs_1.default.existsSync(partPath)) {
            offset = (await fs_1.default.promises.stat(partPath)).size;
        }
        if (fs_1.default.existsSync(checkpointPath)) {
            try {
                const checkpointRaw = await fs_1.default.promises.readFile(checkpointPath, 'utf-8');
                const checkpoint = JSON.parse(checkpointRaw);
                offset = Math.max(offset, checkpoint.offset || 0);
            }
            catch {
                offset = 0;
            }
        }
        let retryCount = 0;
        const maxRetries = 5;
        const expectedSize = file.size || 0;
        let downloaded = offset;
        while (expectedSize === 0 || downloaded < expectedSize) {
            try {
                const headers = {};
                if (downloaded > 0) {
                    headers.Range = `bytes=${downloaded}-`;
                }
                const response = await axios_1.default.get(file.url, {
                    responseType: 'stream',
                    headers,
                    timeout: 30000,
                    validateStatus: (status) => status >= 200 && status < 400,
                });
                if (downloaded > 0 && response.status === 200) {
                    downloaded = 0;
                    await fs_1.default.promises.writeFile(partPath, Buffer.alloc(0));
                }
                await new Promise((resolve, reject) => {
                    const writer = fs_1.default.createWriteStream(partPath, { flags: 'a' });
                    let lastCheckpoint = downloaded;
                    response.data.on('data', (chunk) => {
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
                            fs_1.default.writeFileSync(checkpointPath, JSON.stringify({ offset: downloaded }), 'utf-8');
                        }
                    });
                    response.data.on('error', reject);
                    writer.on('error', reject);
                    writer.on('finish', resolve);
                    response.data.pipe(writer);
                });
                await fs_1.default.promises.writeFile(checkpointPath, JSON.stringify({ offset: downloaded }), 'utf-8');
                if (expectedSize === 0) {
                    break;
                }
            }
            catch (error) {
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
        if (fs_1.default.existsSync(destinationPath)) {
            await fs_1.default.promises.unlink(destinationPath);
        }
        await fs_1.default.promises.rename(partPath, destinationPath);
        if (fs_1.default.existsSync(checkpointPath)) {
            await fs_1.default.promises.unlink(checkpointPath);
        }
        this.emitFileChanged(projectId, file.name, 'download');
    }
    async waitUntilStable(filePath, minStableMs = 1200, retries = 5) {
        let prevSize = -1;
        let prevMtime = 0;
        for (let i = 0; i < retries; i += 1) {
            if (!fs_1.default.existsSync(filePath)) {
                return;
            }
            const statA = await fs_1.default.promises.stat(filePath);
            await delay(minStableMs);
            const statB = await fs_1.default.promises.stat(filePath);
            if (statA.size === statB.size && statA.mtimeMs === statB.mtimeMs && statB.size === prevSize && statB.mtimeMs === prevMtime) {
                return;
            }
            prevSize = statB.size;
            prevMtime = statB.mtimeMs;
        }
    }
    async uploadLocalFile(projectId, localRelPath, localAbsPath, replacingRemoteFile) {
        const user = firebase_1.auth.currentUser;
        if (!user) {
            throw new Error('Upload icin once oturum acmalisiniz.');
        }
        await this.waitUntilStable(localAbsPath);
        if (replacingRemoteFile) {
            await (0, storageService_1.deleteFileFromProject)(projectId, replacingRemoteFile);
        }
        const ext = path_1.default.extname(localAbsPath).replace('.', '').toLowerCase();
        const fileName = path_1.default.basename(localRelPath);
        const contentType = ext === 'pdf'
            ? 'application/pdf'
            : ['dwg', 'dxf'].includes(ext)
                ? 'application/octet-stream'
                : `image/${ext === 'jpg' ? 'jpeg' : ext || 'jpeg'}`;
        const signalId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const stats = await fs_1.default.promises.stat(localAbsPath);
        const fileSize = stats.size;
        const useR2 = (0, r2UploadService_1.shouldUseR2Upload)({ fileName, fileSize, contentType });
        await (0, uploadSignalService_1.upsertProjectUploadSignal)({
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
                const uploadMeta = await (0, r2UploadService_1.createR2UploadUrlSecure)({
                    projectId,
                    fileName,
                    fileSize,
                    contentType,
                });
                if (!uploadMeta?.success || !uploadMeta?.uploadUrl || !uploadMeta?.objectKey) {
                    throw new Error('R2 upload URL olusturulamadi.');
                }
                await (0, r2UploadService_1.uploadFilePathToSignedUrl)(uploadMeta.uploadUrl, localAbsPath, contentType, uploadMeta.pseudoUrl);
                const typeKey = getTypeKey(ext);
                const pseudoUrl = String(uploadMeta.pseudoUrl || `r2://${uploadMeta.objectKey}`).trim();
                await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
                    files: (0, firestore_1.arrayUnion)({
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
                    [`fileCount.${typeKey}`]: (0, firestore_1.increment)(1),
                    totalSize: (0, firestore_1.increment)(fileSize),
                    updatedAt: (0, firestore_1.serverTimestamp)(),
                });
                await (0, uploadSignalService_1.clearProjectUploadSignal)(projectId, signalId).catch(() => null);
                this.emitFileChanged(projectId, localRelPath, 'upload');
                return;
            }
            catch (error) {
                const errorMessage = getErrorMessage(error, 'R2 yukleme hatasi');
                await (0, uploadSignalService_1.upsertProjectUploadSignal)({
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
        const fileBuffer = await fs_1.default.promises.readFile(localAbsPath);
        const storagePath = `users/${user.uid}/projects/${projectId}/${localRelPath}`.replace(/\\/g, '/');
        const sRef = (0, storage_1.ref)(firebase_1.storage, storagePath);
        const task = (0, storage_1.uploadBytesResumable)(sRef, new Uint8Array(fileBuffer));
        await new Promise((resolve, reject) => {
            task.on('state_changed', (snapshot) => {
                const percent = snapshot.totalBytes > 0
                    ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                    : 0;
                this.updateStatus(projectId, {
                    status: 'syncing',
                    progress: percent,
                    currentFile: fileName,
                    isResumable: true,
                });
            }, async (error) => {
                await (0, uploadSignalService_1.upsertProjectUploadSignal)({
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
            }, () => resolve());
        });
        const url = await (0, storage_1.getDownloadURL)(task.snapshot.ref);
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
            files: (0, firestore_1.arrayUnion)({
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
            [`fileCount.${getTypeKey(ext)}`]: (0, firestore_1.increment)(1),
            totalSize: (0, firestore_1.increment)(fileSize),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        await (0, uploadSignalService_1.clearProjectUploadSignal)(projectId, signalId).catch(() => null);
        this.emitFileChanged(projectId, localRelPath, 'upload');
    }
    async buildManifest(projectId, projectPath, files) {
        const entries = [];
        for (const file of files) {
            const localPath = this.resolveLocalPath(projectId, file);
            const localAbs = resolveProjectAbsolutePath(projectPath, localPath);
            if (!fs_1.default.existsSync(localAbs))
                continue;
            const stats = await fs_1.default.promises.stat(localAbs);
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
    watchProject(projectId, projectPath) {
        const existing = this.watchers.get(projectId);
        if (existing) {
            existing.close().catch(() => undefined);
            this.watchers.delete(projectId);
        }
        const watcher = chokidar_1.default.watch(projectPath, {
            ignored: /(^|[/\\])\../,
            persistent: true,
            ignoreInitial: true,
        });
        const handle = (action, filePath) => {
            if (this.syncingProjects.has(projectId))
                return;
            const relative = toPosix(path_1.default.relative(projectPath, filePath));
            if (relative.startsWith('..') || path_1.default.isAbsolute(relative)) {
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
        watcher.on('add', (filePath) => handle('add', filePath));
        watcher.on('change', (filePath) => handle('change', filePath));
        watcher.on('unlink', (filePath) => handle('delete', filePath));
        this.watchers.set(projectId, watcher);
    }
    updateStatus(projectId, patch) {
        const current = this.getStatus(projectId);
        const next = {
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
    emitFileChanged(projectId, file, action) {
        if (!this.win.isDestroyed()) {
            this.win.webContents.send('sync:fileChanged', { projectId, file, action });
        }
    }
}
exports.SyncService = SyncService;
