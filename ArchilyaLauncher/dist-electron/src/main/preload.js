"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    // ════════════════════════════════════════════════════════════
    // PENCERE KONTROLLERI
    // ════════════════════════════════════════════════════════════
    minimize: () => electron_1.ipcRenderer.send('minimize-window'),
    close: () => electron_1.ipcRenderer.send('close-window'),
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    // ════════════════════════════════════════════════════════════
    // AUTH
    // ════════════════════════════════════════════════════════════
    login: (email, password, rememberMe) => electron_1.ipcRenderer.invoke('auth:login', email, password, rememberMe),
    register: (email, password) => electron_1.ipcRenderer.invoke('auth:register', email, password),
    logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    loginGuest: () => electron_1.ipcRenderer.invoke('auth:loginGuest'),
    resetPassword: (email) => electron_1.ipcRenderer.invoke('auth:resetPassword', email),
    checkSession: () => electron_1.ipcRenderer.invoke('auth:checkSession'),
    getSavedEmail: () => electron_1.ipcRenderer.invoke('auth:getSavedEmail'),
    // ════════════════════════════════════════════════════════════
    // PROJELER
    // ════════════════════════════════════════════════════════════
    // Projeleri real-time dinlemeye başla (login sonrası çağır)
    subscribeProjects: (uid) => electron_1.ipcRenderer.invoke('projects:subscribe', uid),
    // Dinlemeyi durdur (logout öncesi çağır)
    unsubscribeProjects: () => electron_1.ipcRenderer.invoke('projects:unsubscribe'),
    // Yeni proje oluştur
    addProject: (data) => electron_1.ipcRenderer.invoke('projects:add', data),
    // Proje güncelle
    updateProject: (projectId, data) => electron_1.ipcRenderer.invoke('projects:update', projectId, data),
    // Projeyi çöp kutusuna gönder
    deleteProject: (projectId) => electron_1.ipcRenderer.invoke('projects:delete', projectId),
    // Projeler değişince tetiklenir (main → renderer)
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
    // ════════════════════════════════════════════════════════════
    // DOSYA YÖNETİMİ
    // ════════════════════════════════════════════════════════════
    // Dosya seçici açıp Storage'a yükle
    uploadFile: (projectId) => electron_1.ipcRenderer.invoke('files:upload', projectId),
    // Dosya sil (Firestore soft delete + Storage delete)
    deleteFile: (projectId, file) => electron_1.ipcRenderer.invoke('files:delete', projectId, file),
    // Upload progress event'leri
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
    // ════════════════════════════════════════════════════════════
    // VR PROJELER (owned_project_ids → projects)
    // ════════════════════════════════════════════════════════════
    getProjects: () => electron_1.ipcRenderer.invoke('get-projects'),
    checkProjectStatus: (project) => electron_1.ipcRenderer.invoke('check-project-status', project),
    downloadProject: (project) => electron_1.ipcRenderer.invoke('download-project', project),
    cancelProjectDownload: (projectId) => electron_1.ipcRenderer.invoke('cancel-project-download', projectId),
    deleteProject_VR: (project) => electron_1.ipcRenderer.invoke('delete-project', project),
    onProjectProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('project-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('project-progress', handler);
    },
    onProjectsUpdated: (callback) => {
        const handler = (_, projects) => callback(projects);
        electron_1.ipcRenderer.on('projects-updated', handler);
        return () => electron_1.ipcRenderer.removeListener('projects-updated', handler);
    },
    // ════════════════════════════════════════════════════════════
    // PAK / VR BUILD SİSTEMİ (SADECE LAUNCHER)
    // ════════════════════════════════════════════════════════════
    checkPakStatus: (projectId, pakFiles, currentVersion) => electron_1.ipcRenderer.invoke('pak:checkStatus', projectId, pakFiles, currentVersion),
    downloadPak: (projectId, pakFiles) => electron_1.ipcRenderer.invoke('pak:download', projectId, pakFiles),
    cancelPakDownload: (projectId) => electron_1.ipcRenderer.invoke('pak:cancelDownload', projectId),
    launchProject: (projectId, mapName) => electron_1.ipcRenderer.invoke('pak:launchProject', projectId, mapName),
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
    // ════════════════════════════════════════════════════════════
    // OYUN (mevcut sistem — değişmedi)
    // ════════════════════════════════════════════════════════════
    checkGameUpdate: () => electron_1.ipcRenderer.invoke('check-game-update'),
    startGameUpdate: (manifest) => electron_1.ipcRenderer.send('start-game-update', manifest),
    launchGame: () => electron_1.ipcRenderer.invoke('launch-game'),
    onGameUpdateProgress: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('game-update-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('game-update-progress', handler);
    },
    onGameUpdateComplete: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('game-update-complete', handler);
        return () => electron_1.ipcRenderer.removeListener('game-update-complete', handler);
    },
    onGameUpdateError: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('game-update-error', handler);
        return () => electron_1.ipcRenderer.removeListener('game-update-error', handler);
    },
    onGameUpdateAvailable: (callback) => {
        const handler = (_, manifest) => callback(manifest);
        electron_1.ipcRenderer.on('game-update-available', handler);
        return () => electron_1.ipcRenderer.removeListener('game-update-available', handler);
    },
    // Launcher auto-updater
    onLauncherUpdateStatus: (callback) => {
        const handler = (_, data) => callback(data);
        electron_1.ipcRenderer.on('launcher-update-status', handler);
        return () => electron_1.ipcRenderer.removeListener('launcher-update-status', handler);
    },
    // Oyun Durum Dinleyicisi
    onGameStatusChanged: (callback) => {
        const handler = (_, isRunning) => callback(isRunning);
        electron_1.ipcRenderer.on('game-status-changed', handler);
        return () => electron_1.ipcRenderer.removeListener('game-status-changed', handler);
    },
});
