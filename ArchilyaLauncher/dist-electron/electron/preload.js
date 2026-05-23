"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    // Pencere Kontrol
    minimize: () => electron_1.ipcRenderer.send('minimize-window'),
    close: () => electron_1.ipcRenderer.send('close-window'),
    // Versiyon
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    // Auth Yönetimi
    login: (email, password, rememberMe) => electron_1.ipcRenderer.invoke('auth:login', email, password, rememberMe),
    loginWithGoogle: (rememberMe) => electron_1.ipcRenderer.invoke('auth:loginWithGoogle', rememberMe),
    register: (email, password) => electron_1.ipcRenderer.invoke('auth:register', email, password),
    resetPassword: (email) => electron_1.ipcRenderer.invoke('auth:resetPassword', email),
    loginGuest: () => electron_1.ipcRenderer.invoke('auth:loginGuest'),
    checkSession: () => electron_1.ipcRenderer.invoke('auth:checkSession'),
    logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    getSavedEmail: () => electron_1.ipcRenderer.invoke('auth:getSavedEmail'),
    // Ayarlar
    getSettings: () => electron_1.ipcRenderer.invoke('settings:get'),
    updateSettings: (settings) => electron_1.ipcRenderer.invoke('settings:update', settings),
    // Firebase Proje Yönetimi (Yeni)
    subscribeProjects: (uid) => electron_1.ipcRenderer.invoke('projects:subscribe', uid),
    unsubscribeProjects: () => electron_1.ipcRenderer.invoke('projects:unsubscribe'),
    addProject: (data) => electron_1.ipcRenderer.invoke('projects:add', data),
    updateProject: (projectId, data) => electron_1.ipcRenderer.invoke('projects:update', projectId, data),
    deleteProject: (projectId) => electron_1.ipcRenderer.invoke('projects:delete', projectId),
    onProjectsChanged: (callback) => {
        const handler = (_, projects) => callback(projects);
        electron_1.ipcRenderer.on('projects:changed', handler);
        return () => electron_1.ipcRenderer.removeListener('projects:changed', handler);
    },
    onProjectsError: (callback) => {
        const handler = (_, error) => callback(error);
        electron_1.ipcRenderer.on('projects:error', handler);
        return () => electron_1.ipcRenderer.removeListener('projects:error', handler);
    },
    // Dosya Yönetimi (Yeni)
    uploadFile: (projectId) => electron_1.ipcRenderer.invoke('files:upload', projectId),
    deleteFile: (projectId, file) => electron_1.ipcRenderer.invoke('files:delete', projectId, file),
    onUploadProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('upload-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('upload-progress', handler);
    },
    onUploadComplete: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('upload-complete', handler);
        return () => electron_1.ipcRenderer.removeListener('upload-complete', handler);
    },
    onUploadError: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('upload-error', handler);
        return () => electron_1.ipcRenderer.removeListener('upload-error', handler);
    },
    // Dosya Senkronizasyonu
    getLocalProjectPath: (projectId) => electron_1.ipcRenderer.invoke('sync:getLocalProjectPath', projectId),
    syncProject: (projectId) => electron_1.ipcRenderer.invoke('sync:project', projectId),
    syncAllProjects: () => electron_1.ipcRenderer.invoke('sync:all'),
    getSyncStatus: (projectId) => electron_1.ipcRenderer.invoke('sync:getStatus', projectId),
    openProjectFolder: (projectId) => electron_1.ipcRenderer.invoke('sync:openProjectFolder', projectId),
    setSyncFolder: () => electron_1.ipcRenderer.invoke('sync:setFolder'),
    onSyncProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('sync:progress', handler);
        return () => electron_1.ipcRenderer.removeListener('sync:progress', handler);
    },
    onFileChanged: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('sync:fileChanged', handler);
        return () => electron_1.ipcRenderer.removeListener('sync:fileChanged', handler);
    },
    notifySyncOnline: () => electron_1.ipcRenderer.invoke('sync:notifyOnline'),
    notifySyncFocus: () => electron_1.ipcRenderer.invoke('sync:notifyFocus'),
    // Eski Project Manager API (arka uyumluluk)
    getProjects: () => electron_1.ipcRenderer.invoke('get-projects'),
    checkProjectStatus: (project) => electron_1.ipcRenderer.invoke('check-project-status', project),
    downloadProject: (project) => electron_1.ipcRenderer.invoke('download-project', project),
    cancelProjectDownload: (projectId) => electron_1.ipcRenderer.invoke('cancel-project-download', projectId),
    deleteProject_VR: (project) => electron_1.ipcRenderer.invoke('delete-project', project),
    onProjectProgress: (callback) => {
        const subscription = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('project-progress', subscription);
        return () => electron_1.ipcRenderer.removeListener('project-progress', subscription);
    },
    onProjectsUpdated: (callback) => {
        const subscription = (_event, projects) => callback(projects);
        electron_1.ipcRenderer.on('projects-updated', subscription);
        return () => electron_1.ipcRenderer.removeListener('projects-updated', subscription);
    },
    // ── PAK / VR Build Sistemi (SADECE Launcher) ─────────────
    checkPakStatus: (projectId, pakFiles, currentVersion) => electron_1.ipcRenderer.invoke('pak:checkStatus', projectId, pakFiles, currentVersion),
    downloadPak: (projectId, pakFiles) => electron_1.ipcRenderer.invoke('pak:download', projectId, pakFiles),
    cancelPakDownload: (projectId) => electron_1.ipcRenderer.invoke('pak:cancelDownload', projectId),
    launchProjectPak: (projectId, mapName) => electron_1.ipcRenderer.invoke('pak:launchProject', projectId, mapName),
    launchArchilya: (request) => electron_1.ipcRenderer.invoke('archilya:launch', request),
    startWebShare: (request) => electron_1.ipcRenderer.invoke('streaming:start', request),
    stopWebShare: () => electron_1.ipcRenderer.invoke('streaming:stop'),
    getWebShareStatus: () => electron_1.ipcRenderer.invoke('streaming:status'),
    getMachineIdentity: () => electron_1.ipcRenderer.invoke('machine:getIdentity'),
    getRemoteCommandHistory: (limit = 40) => electron_1.ipcRenderer.invoke('commands:getHistory', limit),
    onPakDownloadProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('pak:progress', handler);
        return () => electron_1.ipcRenderer.removeListener('pak:progress', handler);
    },
    onPakDownloadComplete: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('pak:complete', handler);
        return () => electron_1.ipcRenderer.removeListener('pak:complete', handler);
    },
    onPakDownloadError: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('pak:error', handler);
        return () => electron_1.ipcRenderer.removeListener('pak:error', handler);
    },
    // Archilya motor yönetimi
    checkGameUpdate: () => electron_1.ipcRenderer.invoke('check-game-update'),
    startGameUpdate: (manifest) => electron_1.ipcRenderer.send('start-game-update', manifest),
    launchGame: () => electron_1.ipcRenderer.invoke('launch-game'),
    // Event Listeners (Oyun)
    onGameUpdateProgress: (callback) => {
        const subscription = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('game-update-progress', subscription);
        return () => electron_1.ipcRenderer.removeListener('game-update-progress', subscription);
    },
    onGameUpdateComplete: (callback) => {
        const subscription = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('game-update-complete', subscription);
        return () => electron_1.ipcRenderer.removeListener('game-update-complete', subscription);
    },
    onGameUpdateError: (callback) => {
        const subscription = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('game-update-error', subscription);
        return () => electron_1.ipcRenderer.removeListener('game-update-error', subscription);
    },
    onGameUpdateAvailable: (callback) => {
        const subscription = (_event, manifest) => callback(manifest);
        electron_1.ipcRenderer.on('game-update-available', subscription);
        return () => electron_1.ipcRenderer.removeListener('game-update-available', subscription);
    },
    // Launcher Update Status (Daha esnek yapı)
    onLauncherUpdateStatus: (callback) => {
        const subscription = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('launcher-update-status', subscription);
        return () => electron_1.ipcRenderer.removeListener('launcher-update-status', subscription);
    },
    // Oyun Durum Dinleyicisi
    onGameStatusChanged: (callback) => {
        const handler = (_, isRunning) => callback(isRunning);
        electron_1.ipcRenderer.on('game-status-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('game-status-changed', handler);
    },
    // ── AI Motor (FAZ 2.1) ──────────────────────────────────────────
    createAiJob: (request) => electron_1.ipcRenderer.invoke('ai:generate', request),
    checkAiJobStatus: (jobId) => electron_1.ipcRenderer.invoke('ai:status', jobId),
    cancelAiJob: (jobId) => electron_1.ipcRenderer.invoke('ai:cancel', jobId),
    onAiJobProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('ai:progress', handler);
        return () => electron_1.ipcRenderer.removeListener('ai:progress', handler);
    },
    onAiJobComplete: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('ai:complete', handler);
        return () => electron_1.ipcRenderer.removeListener('ai:complete', handler);
    },
    // ── Dosya Sistemi (FAZ 2.2) ─────────────────────────────────────
    listDirectory: (directoryPath) => electron_1.ipcRenderer.invoke('fs:list', directoryPath),
    watchDirectory: (directoryPath, projectId) => electron_1.ipcRenderer.invoke('fs:watch', directoryPath, projectId),
    unwatchDirectory: (directoryPath) => electron_1.ipcRenderer.invoke('fs:unwatch', directoryPath),
    onDirectoryChanged: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('fs:changed', handler);
        return () => electron_1.ipcRenderer.removeListener('fs:changed', handler);
    },
    // ── Oto-Kilit İstihbaratı (FAZ 2.3) ─────────────────────────────
    onFileLockChanged: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('fs:lockChanged', handler);
        return () => electron_1.ipcRenderer.removeListener('fs:lockChanged', handler);
    },
    // ── Dosya Açma (FAZ 2.4) ────────────────────────────────────────
    openFile: (filePath) => electron_1.ipcRenderer.invoke('fs:openFile', filePath),
    // ── Dosya Kopyalama (FAZ 2.4) ───────────────────────────────────
    copyFiles: (destDir, filePaths) => electron_1.ipcRenderer.invoke('fs:copyFiles', destDir, filePaths),
    // ── Dosya İndirme (Cross-origin) ────────────────────────────────
    downloadFile: (url, filename) => electron_1.ipcRenderer.invoke('file:download', url, filename),
    // ── Versiyon Yönetimi (FAZ 2.5) ─────────────────────────────────
    listFileVersions: (projectId, fileId) => electron_1.ipcRenderer.invoke('version:list', projectId, fileId),
    restoreFileVersion: (projectId, versionId, localDirPath) => electron_1.ipcRenderer.invoke('version:restore', projectId, versionId, localDirPath),
    updateVersionNote: (request) => electron_1.ipcRenderer.invoke('version:note', request),
});
