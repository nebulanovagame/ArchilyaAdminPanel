"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectManager = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const functions_1 = require("firebase/functions");
const child_process_1 = require("child_process");
const firebase_1 = require("../src/main/firebase");
function toBoundedPositiveInt(value, fallback, min, max) {
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
const PROJECT_DOWNLOAD_CONCURRENCY = toBoundedPositiveInt(process.env.ARCHILYA_PROJECT_DOWNLOAD_CONCURRENCY, 2, 1, 4);
const projectDownloadHttpAgent = new http_1.default.Agent({
    keepAlive: true,
    maxSockets: 16,
    maxFreeSockets: 8,
    keepAliveMsecs: 1000,
});
const projectDownloadHttpsAgent = new https_1.default.Agent({
    keepAlive: true,
    maxSockets: 16,
    maxFreeSockets: 8,
    keepAliveMsecs: 1000,
});
const projectDownloadAxios = axios_1.default.create({
    httpAgent: projectDownloadHttpAgent,
    httpsAgent: projectDownloadHttpsAgent,
    timeout: PROJECT_DOWNLOAD_REQUEST_TIMEOUT_MS,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
});
const electron_log_1 = __importDefault(require("electron-log"));
class ProjectManager {
    mainWindow;
    gameInstallPath;
    paksPath;
    activeDownloads = new Map();
    protectedFiles = [
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
    constructor(mainWindow, gameInstallPath) {
        this.mainWindow = mainWindow;
        this.gameInstallPath = gameInstallPath;
        this.paksPath = path_1.default.join(this.gameInstallPath, 'Archilya', 'Content', 'Paks');
        if (!fs_1.default.existsSync(this.paksPath)) {
            fs_1.default.mkdirSync(this.paksPath, { recursive: true });
        }
        this.setupHandlers();
    }
    setupHandlers() {
        electron_1.ipcMain.handle('check-project-status', async (_, project) => {
            return this.checkProjectStatus(project);
        });
        electron_1.ipcMain.handle('download-project', async (_, project) => {
            return this.downloadProject(project);
        });
        electron_1.ipcMain.handle('cancel-project-download', async (_, projectId) => {
            const source = this.activeDownloads.get(projectId);
            if (source) {
                source.cancel('User cancelled download');
                this.activeDownloads.delete(projectId);
                return true;
            }
            return false;
        });
        electron_1.ipcMain.handle('delete-project', async (_, project) => {
            return this.deleteProject(project);
        });
    }
    resolveR2ObjectKey(file) {
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
    needsSignedDownloadUrl(file) {
        const provider = typeof file.storageProvider === 'string'
            ? file.storageProvider.trim().toLowerCase()
            : '';
        const rawUrl = typeof file.url === 'string' ? file.url.trim().toLowerCase() : '';
        return provider === 'r2' || rawUrl.startsWith('r2://');
    }
    mapR2DownloadUrlError(error, fileName) {
        const code = String(error?.code || '').toLowerCase();
        const rawMessage = String(error?.message || '').trim();
        if (code.includes('unauthenticated')) {
            return new Error(`${fileName}: Demo dosyasini indirmek icin giris yapmaniz gerekiyor.`);
        }
        if (code.includes('permission-denied')) {
            return new Error(`${fileName}: Bu demo dosyasina erisim yetkiniz yok.`);
        }
        if (code.includes('not-found') || code.includes('unimplemented')) {
            return new Error(`${fileName}: R2 indirme servisi bulunamadi. Launcher ve Cloud Function surumlerini guncelleyin.`);
        }
        if (rawMessage) {
            return new Error(`${fileName}: R2 indirme baglantisi olusturulamadi (${rawMessage}).`);
        }
        return new Error(`${fileName}: R2 indirme baglantisi olusturulamadi.`);
    }
    async resolveProjectFileDownloadUrl(projectId, file) {
        const directUrl = typeof file.url === 'string' ? file.url.trim() : '';
        if (!this.needsSignedDownloadUrl(file)) {
            if (!directUrl) {
                throw new Error(`${file.name}: Indirme baglantisi bulunamadi.`);
            }
            return directUrl;
        }
        if (!firebase_1.auth.currentUser) {
            throw new Error(`${file.name}: Demo dosyasini indirmek icin aktif kullanici bulunamadi.`);
        }
        const objectKey = this.resolveR2ObjectKey(file);
        if (!objectKey) {
            throw new Error(`${file.name}: R2 objectKey bilgisi eksik.`);
        }
        try {
            const callable = (0, functions_1.httpsCallable)(firebase_1.functions, 'createR2ProductDownloadUrlSecure');
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
        }
        catch (error) {
            throw this.mapR2DownloadUrlError(error, file.name);
        }
    }
    isDownloadCancellationError(error) {
        if (axios_1.default.isCancel(error)) {
            return true;
        }
        const code = String(error?.code || '').toUpperCase();
        if (code === 'ERR_CANCELED' || code === 'ERR_CANCELLED') {
            return true;
        }
        const message = String(error?.message || '').toLowerCase();
        return message.includes('canceled') || message.includes('cancelled');
    }
    isRetryableDownloadError(error) {
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
    buildDownloadError(error, fileName) {
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
    async wait(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    async downloadProjectFileWithRetry(projectId, file, destinationPath, source, setDownloadedBytes) {
        await fs_1.default.promises.mkdir(path_1.default.dirname(destinationPath), { recursive: true });
        const partialPath = `${destinationPath}.part`;
        if (fs_1.default.existsSync(partialPath)) {
            try {
                await fs_1.default.promises.unlink(partialPath);
            }
            catch {
                // ignore stale partial cleanup errors
            }
        }
        setDownloadedBytes(0);
        for (let attempt = 1; attempt <= PROJECT_DOWNLOAD_RETRY_ATTEMPTS; attempt += 1) {
            let downloaded = fs_1.default.existsSync(partialPath)
                ? (await fs_1.default.promises.stat(partialPath)).size
                : 0;
            setDownloadedBytes(downloaded);
            try {
                const downloadUrl = await this.resolveProjectFileDownloadUrl(projectId, file);
                const headers = {};
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
                    await fs_1.default.promises.writeFile(partialPath, Buffer.alloc(0));
                }
                await new Promise((resolve, reject) => {
                    const writer = fs_1.default.createWriteStream(partialPath, {
                        flags: downloaded > 0 ? 'a' : 'w',
                        highWaterMark: PROJECT_DOWNLOAD_STREAM_BUFFER_BYTES,
                    });
                    let settled = false;
                    const done = (error) => {
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
                    response.data.on('data', (chunk) => {
                        downloaded += chunk.length;
                        setDownloadedBytes(downloaded);
                    });
                    response.data.on('error', (error) => {
                        writer.destroy();
                        done(error);
                    });
                    writer.on('error', (error) => {
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
                    const finalSize = (await fs_1.default.promises.stat(partialPath)).size;
                    if (finalSize < file.size) {
                        throw new Error(`${file.name}: eksik indirme algilandi.`);
                    }
                }
                if (fs_1.default.existsSync(destinationPath)) {
                    await fs_1.default.promises.unlink(destinationPath);
                }
                await fs_1.default.promises.rename(partialPath, destinationPath);
                return;
            }
            catch (error) {
                if (this.isDownloadCancellationError(error)) {
                    throw new Error('Indirme iptal edildi.');
                }
                const status = Number(error?.response?.status || 0);
                if (status === 416) {
                    downloaded = 0;
                    setDownloadedBytes(0);
                    await fs_1.default.promises.writeFile(partialPath, Buffer.alloc(0));
                }
                if (attempt >= PROJECT_DOWNLOAD_RETRY_ATTEMPTS || !this.isRetryableDownloadError(error)) {
                    throw this.buildDownloadError(error, file.name);
                }
                const retryDelay = PROJECT_DOWNLOAD_RETRY_BASE_DELAY_MS * attempt;
                await this.wait(retryDelay);
            }
        }
    }
    checkProjectStatus(project) {
        const allFilesExist = project.files.every(file => {
            const filePath = path_1.default.join(this.paksPath, file.name);
            return fs_1.default.existsSync(filePath);
        });
        return allFilesExist ? 'INSTALLED' : 'NOT_INSTALLED';
    }
    async downloadProject(project) {
        const totalSize = project.files.reduce((acc, file) => acc + (file.size || 0), 0);
        const source = axios_1.default.CancelToken.source();
        this.activeDownloads.set(project.id, source);
        const downloadedByFile = new Map();
        let totalDownloaded = 0;
        let completedFiles = 0;
        let nextProgressEmitAt = 0;
        let lastProgress = -1;
        const setFileDownloaded = (fileKey, bytes) => {
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
        const emitProgress = (status, force = false) => {
            const now = Date.now();
            if (!force && now < nextProgressEmitAt) {
                return;
            }
            let progress = 0;
            if (totalSize > 0) {
                progress = Math.round((totalDownloaded / totalSize) * 100);
                progress = Math.max(0, Math.min(progress, force ? 100 : 99));
            }
            else if (project.files.length > 0) {
                progress = Math.round((completedFiles / project.files.length) * 100);
                progress = Math.max(0, Math.min(progress, force ? 100 : 99));
            }
            else {
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
            let firstError = null;
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
                    const filePath = path_1.default.join(this.paksPath, file.name);
                    try {
                        await this.downloadProjectFileWithRetry(project.id, file, filePath, source, (bytes) => {
                            setFileDownloaded(fileKey, bytes);
                            emitProgress(`${file.name} indiriliyor...`);
                        });
                        completedFiles += 1;
                        emitProgress(`${completedFiles}/${queue.length} dosya tamamlandi`, true);
                    }
                    catch (error) {
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
        }
        catch (error) {
            for (const file of project.files) {
                const filePath = path_1.default.join(this.paksPath, file.name);
                const partialPath = `${filePath}.part`;
                if (fs_1.default.existsSync(filePath)) {
                    try {
                        fs_1.default.unlinkSync(filePath);
                    }
                    catch {
                        // ignore cleanup errors
                    }
                }
                if (fs_1.default.existsSync(partialPath)) {
                    try {
                        fs_1.default.unlinkSync(partialPath);
                    }
                    catch {
                        // ignore cleanup errors
                    }
                }
            }
            const message = this.isDownloadCancellationError(error)
                ? 'Indirme iptal edildi.'
                : (error?.message || 'Indirme basarisiz oldu.');
            return { success: false, message };
        }
        finally {
            this.activeDownloads.delete(project.id);
        }
    }
    createLocalManifest(projects) {
        // Hedef: .../Archilya/Saved/LocalProjects.json
        const savedDir = path_1.default.join(this.gameInstallPath, 'Archilya', 'Saved');
        if (!fs_1.default.existsSync(savedDir)) {
            try {
                fs_1.default.mkdirSync(savedDir, { recursive: true });
            }
            catch (e) {
                electron_log_1.default.error('Saved directory could not be created:', e);
                return;
            }
        }
        const manifestPath = path_1.default.join(savedDir, 'LocalProjects.json');
        const data = {
            projects: projects.map(p => ({
                title: p.title,
                map_name: p.map_name
            }))
        };
        try {
            fs_1.default.writeFileSync(manifestPath, JSON.stringify(data, null, 2));
            electron_log_1.default.info('LocalProjects.json created successfully at:', manifestPath);
        }
        catch (error) {
            electron_log_1.default.error('Failed to write LocalProjects.json:', error);
        }
    }
    async launchProject(project, authArgs = []) {
        const exePath = path_1.default.join(this.gameInstallPath, 'Archilya.exe');
        if (!fs_1.default.existsSync(exePath)) {
            return { success: false, message: 'Oyun dosyası bulunamadı.' };
        }
        // SENARYO B: Direkt Proje Başlatma
        const mapName = (project.map_name || '').trim();
        if (!mapName) {
            electron_log_1.default.warn(`[Launch] Warning: Project ${project.id} has no map_name defined. Game will launch to default menu.`);
        }
        // Auth Argümanları (UID, Token vb.) authArgs içinde gelmelidir.
        const args = [
            `-MapToOpen="${mapName}"`,
            ...authArgs
        ];
        electron_log_1.default.info(`Launching project ${project.id} with map ${mapName} and auth args`);
        const gameProcess = (0, child_process_1.spawn)(exePath, args, {
            detached: true,
            cwd: path_1.default.dirname(exePath),
            stdio: 'ignore'
        });
        gameProcess.unref();
        return { success: true };
    }
    async deleteProject(project) {
        try {
            for (const file of project.files) {
                const filePath = path_1.default.join(this.paksPath, file.name);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            }
            return { success: true };
        }
        catch (error) {
            electron_log_1.default.error(`[deleteProject] Silinemedi:`, error);
            const isLocked = error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES';
            return {
                success: false,
                message: isLocked
                    ? 'Dosya şu an kullanımda. Lütfen oyunu kapatın ve tekrar deneyin.'
                    : `Silinemedi: ${error.message}`,
            };
        }
    }
    clearAllProjects() {
        if (!fs_1.default.existsSync(this.paksPath))
            return;
        const files = fs_1.default.readdirSync(this.paksPath);
        for (const file of files) {
            if (!this.protectedFiles.includes(file)) {
                const filePath = path_1.default.join(this.paksPath, file);
                try {
                    if (fs_1.default.lstatSync(filePath).isFile()) {
                        fs_1.default.unlinkSync(filePath);
                    }
                }
                catch (e) {
                    electron_log_1.default.error(`Error deleting file during cleanup: ${file}`, e);
                }
            }
        }
        electron_log_1.default.info('Disk cleanup completed (logout/switch).');
    }
    syncDisk(authorizedProjects) {
        if (!fs_1.default.existsSync(this.paksPath))
            return;
        const authorizedFiles = new Set(this.protectedFiles);
        for (const project of authorizedProjects) {
            for (const file of project.files) {
                authorizedFiles.add(file.name);
            }
        }
        const filesOnDisk = fs_1.default.readdirSync(this.paksPath);
        for (const file of filesOnDisk) {
            if (!authorizedFiles.has(file)) {
                const filePath = path_1.default.join(this.paksPath, file);
                try {
                    if (fs_1.default.lstatSync(filePath).isFile()) {
                        fs_1.default.unlinkSync(filePath);
                        electron_log_1.default.info(`Deleted unauthorized project file: ${file}`);
                    }
                }
                catch (e) {
                    electron_log_1.default.error(`Error deleting unauthorized file: ${file}`, e);
                }
            }
        }
    }
}
exports.ProjectManager = ProjectManager;
