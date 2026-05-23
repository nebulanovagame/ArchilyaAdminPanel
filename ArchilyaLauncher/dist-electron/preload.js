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
    login: (email, password, rememberMe) => electron_1.ipcRenderer.invoke('auth-login', { email, password, rememberMe }),
    register: (email, password) => electron_1.ipcRenderer.invoke('auth-register', { email, password }),
    resetPassword: (email) => electron_1.ipcRenderer.invoke('auth-reset-password', { email }),
    loginGuest: () => electron_1.ipcRenderer.invoke('auth-login-guest'),
    checkSession: () => electron_1.ipcRenderer.invoke('auth-check'),
    logout: () => electron_1.ipcRenderer.invoke('auth-logout'),
    // Project Manager API
    getProjects: () => electron_1.ipcRenderer.invoke('get-projects'),
    checkProjectStatus: (project) => electron_1.ipcRenderer.invoke('check-project-status', project),
    downloadProject: (project) => electron_1.ipcRenderer.invoke('download-project', project),
    cancelProjectDownload: (projectId) => electron_1.ipcRenderer.invoke('cancel-project-download', projectId),
    launchProject: (project) => electron_1.ipcRenderer.invoke('launch-project', project),
    deleteProject: (project) => electron_1.ipcRenderer.invoke('delete-project', project),
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
    // Yeni Oyun Yönetimi
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
    }
});
