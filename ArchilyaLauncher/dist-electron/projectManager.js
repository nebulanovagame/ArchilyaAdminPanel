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
const child_process_1 = require("child_process");
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
        'pakchunk0-Windows.utoc'
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
    checkProjectStatus(project) {
        const allFilesExist = project.files.every(file => {
            const filePath = path_1.default.join(this.paksPath, file.name);
            return fs_1.default.existsSync(filePath);
        });
        return allFilesExist ? 'INSTALLED' : 'NOT_INSTALLED';
    }
    async downloadProject(project) {
        const totalSize = project.files.reduce((acc, file) => acc + file.size, 0);
        let downloadedSize = 0;
        const source = axios_1.default.CancelToken.source();
        this.activeDownloads.set(project.id, source);
        try {
            for (const file of project.files) {
                const filePath = path_1.default.join(this.paksPath, file.name);
                const writer = fs_1.default.createWriteStream(filePath);
                const response = await (0, axios_1.default)({
                    url: file.url,
                    method: 'GET',
                    responseType: 'stream',
                    cancelToken: source.token
                });
                let fileDownloadedSize = 0;
                response.data.on('data', (chunk) => {
                    fileDownloadedSize += chunk.length;
                    const currentTotalProgress = Math.round(((downloadedSize + fileDownloadedSize) / totalSize) * 100);
                    this.mainWindow.webContents.send('project-progress', {
                        projectId: project.id,
                        progress: currentTotalProgress
                    });
                });
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve());
                    writer.on('error', (err) => reject(err));
                    source.token.promise.then(() => {
                        writer.destroy();
                        reject(new Error('Download cancelled by user'));
                    });
                });
                downloadedSize += file.size;
            }
            this.activeDownloads.delete(project.id);
            this.mainWindow.webContents.send('project-progress', {
                projectId: project.id,
                progress: 100
            });
        }
        catch (error) {
            this.activeDownloads.delete(project.id);
            // Clean up files if cancelled or error
            for (const file of project.files) {
                const filePath = path_1.default.join(this.paksPath, file.name);
                if (fs_1.default.existsSync(filePath)) {
                    fs_1.default.unlinkSync(filePath);
                }
            }
            throw error;
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
        for (const file of project.files) {
            const filePath = path_1.default.join(this.paksPath, file.name);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
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
