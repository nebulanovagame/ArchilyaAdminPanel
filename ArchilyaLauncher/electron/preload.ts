import { contextBridge, ipcRenderer } from 'electron';
import type { LaunchRequest } from '../src/shared/launchProfiles';
import type { WebShareStartRequest } from '../src/shared/streamingTypes';
import type { MachineIdentityInfo, RemoteCommandHistoryEntry } from '../src/shared/remoteCommandTypes';
import type { AiGenerateRequest, AiJobProgressEvent, AiJobCompleteEvent } from '../src/shared/aiTypes';
import type { FsWatchEvent, FileLockEvent } from '../src/shared/fsTypes';
import type { LauncherSettings, UploadProgressData, UploadCompleteData, UploadErrorData } from '../src/shared/types';
import type { VersionNoteRequest } from '../src/shared/versionTypes';

contextBridge.exposeInMainWorld('api', {
  // Pencere Kontrol
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),

  // Versiyon
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Auth Yönetimi
  login: (email: string, password: string, rememberMe: boolean) => ipcRenderer.invoke('auth:login', email, password, rememberMe),
  loginWithGoogle: (rememberMe: boolean) => ipcRenderer.invoke('auth:loginWithGoogle', rememberMe),
  register: (email: string, password: string) => ipcRenderer.invoke('auth:register', email, password),
  resetPassword: (email: string) => ipcRenderer.invoke('auth:resetPassword', email),
  loginGuest: () => ipcRenderer.invoke('auth:loginGuest'),
  checkSession: () => ipcRenderer.invoke('auth:checkSession'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSavedEmail: () => ipcRenderer.invoke('auth:getSavedEmail'),

  // Ayarlar
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<LauncherSettings>) => ipcRenderer.invoke('settings:update', settings),

  // Firebase Proje Yönetimi (Yeni)
  subscribeProjects: (uid: string) => ipcRenderer.invoke('projects:subscribe', uid),
  unsubscribeProjects: () => ipcRenderer.invoke('projects:unsubscribe'),
  addProject: (data: any) => ipcRenderer.invoke('projects:add', data),
  updateProject: (projectId: string, data: any) => ipcRenderer.invoke('projects:update', projectId, data),
  deleteProject: (projectId: string) => ipcRenderer.invoke('projects:delete', projectId),
  onProjectsChanged: (callback: (projects: any[]) => void) => {
    const handler = (_: any, projects: any[]) => callback(projects);
    ipcRenderer.on('projects:changed', handler);
    return () => ipcRenderer.removeListener('projects:changed', handler);
  },
  onProjectsError: (callback: (error: string) => void) => {
    const handler = (_: any, error: string) => callback(error);
    ipcRenderer.on('projects:error', handler);
    return () => ipcRenderer.removeListener('projects:error', handler);
  },

  // Dosya Yönetimi (Yeni)
  uploadFile: (projectId: string) => ipcRenderer.invoke('files:upload', projectId),
  deleteFile: (projectId: string, file: any) => ipcRenderer.invoke('files:delete', projectId, file),
  onUploadProgress: (callback: (data: UploadProgressData) => void) => {
    const handler = (_: any, data: UploadProgressData) => callback(data);
    ipcRenderer.on('upload-progress', handler);
    return () => ipcRenderer.removeListener('upload-progress', handler);
  },
  onUploadComplete: (callback: (data: UploadCompleteData) => void) => {
    const handler = (_: any, data: UploadCompleteData) => callback(data);
    ipcRenderer.on('upload-complete', handler);
    return () => ipcRenderer.removeListener('upload-complete', handler);
  },
  onUploadError: (callback: (data: UploadErrorData) => void) => {
    const handler = (_: any, data: UploadErrorData) => callback(data);
    ipcRenderer.on('upload-error', handler);
    return () => ipcRenderer.removeListener('upload-error', handler);
  },

  // Dosya Senkronizasyonu
  getLocalProjectPath: (projectId: string) => ipcRenderer.invoke('sync:getLocalProjectPath', projectId),
  syncProject: (projectId: string) => ipcRenderer.invoke('sync:project', projectId),
  syncAllProjects: () => ipcRenderer.invoke('sync:all'),
  getSyncStatus: (projectId: string) => ipcRenderer.invoke('sync:getStatus', projectId),
  openProjectFolder: (projectId: string) => ipcRenderer.invoke('sync:openProjectFolder', projectId),
  setSyncFolder: () => ipcRenderer.invoke('sync:setFolder'),
  onSyncProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },
  onFileChanged: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('sync:fileChanged', handler);
    return () => ipcRenderer.removeListener('sync:fileChanged', handler);
  },
  notifySyncOnline: () => ipcRenderer.invoke('sync:notifyOnline'),
  notifySyncFocus: () => ipcRenderer.invoke('sync:notifyFocus'),

  // Eski Project Manager API (arka uyumluluk)
  getProjects: () => ipcRenderer.invoke('get-projects'),
  checkProjectStatus: (project: any) => ipcRenderer.invoke('check-project-status', project),
  downloadProject: (project: any) => ipcRenderer.invoke('download-project', project),
  cancelProjectDownload: (projectId: string) => ipcRenderer.invoke('cancel-project-download', projectId),
  deleteProject_VR: (project: any) => ipcRenderer.invoke('delete-project', project),
  onProjectProgress: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('project-progress', subscription);
    return () => ipcRenderer.removeListener('project-progress', subscription);
  },
  onProjectsUpdated: (callback: (projects: any[]) => void) => {
    const subscription = (_event: any, projects: any[]) => callback(projects);
    ipcRenderer.on('projects-updated', subscription);
    return () => ipcRenderer.removeListener('projects-updated', subscription);
  },

  // ── PAK / VR Build Sistemi (SADECE Launcher) ─────────────
  checkPakStatus: (projectId: string, pakFiles: any[], currentVersion: string) =>
    ipcRenderer.invoke('pak:checkStatus', projectId, pakFiles, currentVersion),

  downloadPak: (projectId: string, pakFiles: any[]) =>
    ipcRenderer.invoke('pak:download', projectId, pakFiles),

  cancelPakDownload: (projectId: string) =>
    ipcRenderer.invoke('pak:cancelDownload', projectId),

  launchProjectPak: (projectId: string, mapName: string) =>
    ipcRenderer.invoke('pak:launchProject', projectId, mapName),

  launchArchilya: (request: LaunchRequest) =>
    ipcRenderer.invoke('archilya:launch', request),

  startWebShare: (request: WebShareStartRequest) =>
    ipcRenderer.invoke('streaming:start', request),

  stopWebShare: () =>
    ipcRenderer.invoke('streaming:stop'),

  getWebShareStatus: () =>
    ipcRenderer.invoke('streaming:status'),

  getMachineIdentity: (): Promise<MachineIdentityInfo> =>
    ipcRenderer.invoke('machine:getIdentity'),

  getRemoteCommandHistory: (limit = 40): Promise<RemoteCommandHistoryEntry[]> =>
    ipcRenderer.invoke('commands:getHistory', limit),

  onPakDownloadProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('pak:progress', handler);
    return () => ipcRenderer.removeListener('pak:progress', handler);
  },

  onPakDownloadComplete: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('pak:complete', handler);
    return () => ipcRenderer.removeListener('pak:complete', handler);
  },

  onPakDownloadError: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('pak:error', handler);
    return () => ipcRenderer.removeListener('pak:error', handler);
  },

  // Archilya motor yönetimi
  checkGameUpdate: () => ipcRenderer.invoke('check-game-update'),
  startGameUpdate: (manifest: any) => ipcRenderer.send('start-game-update', manifest),
  launchGame: () => ipcRenderer.invoke('launch-game'),

  // Event Listeners (Oyun)
  onGameUpdateProgress: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('game-update-progress', subscription);
    return () => ipcRenderer.removeListener('game-update-progress', subscription);
  },
  onGameUpdateComplete: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('game-update-complete', subscription);
    return () => ipcRenderer.removeListener('game-update-complete', subscription);
  },
  onGameUpdateError: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('game-update-error', subscription);
    return () => ipcRenderer.removeListener('game-update-error', subscription);
  },
  onGameUpdateAvailable: (callback: (manifest: any) => void) => {
    const subscription = (_event: any, manifest: any) => callback(manifest);
    ipcRenderer.on('game-update-available', subscription);
    return () => ipcRenderer.removeListener('game-update-available', subscription);
  },

  // Launcher Update Status (Daha esnek yapı)
  onLauncherUpdateStatus: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('launcher-update-status', subscription);
    return () => ipcRenderer.removeListener('launcher-update-status', subscription);
  },

  // Oyun Durum Dinleyicisi
  onGameStatusChanged: (callback: (isRunning: boolean) => void) => {
    const handler = (_: any, isRunning: boolean) => callback(isRunning);
    ipcRenderer.on('game-status-changed', handler);
    return () => ipcRenderer.removeListener('game-status-changed', handler);
  },

  // ── AI Motor (FAZ 2.1) ──────────────────────────────────────────
  createAiJob: (request: AiGenerateRequest) =>
    ipcRenderer.invoke('ai:generate', request),

  checkAiJobStatus: (jobId: string) =>
    ipcRenderer.invoke('ai:status', jobId),

  cancelAiJob: (jobId: string) =>
    ipcRenderer.invoke('ai:cancel', jobId),

  onAiJobProgress: (callback: (data: AiJobProgressEvent) => void) => {
    const handler = (_: any, data: AiJobProgressEvent) => callback(data);
    ipcRenderer.on('ai:progress', handler);
    return () => ipcRenderer.removeListener('ai:progress', handler);
  },

  onAiJobComplete: (callback: (data: AiJobCompleteEvent) => void) => {
    const handler = (_: any, data: AiJobCompleteEvent) => callback(data);
    ipcRenderer.on('ai:complete', handler);
    return () => ipcRenderer.removeListener('ai:complete', handler);
  },

  // ── Dosya Sistemi (FAZ 2.2) ─────────────────────────────────────
  listDirectory: (directoryPath: string) =>
    ipcRenderer.invoke('fs:list', directoryPath),

  watchDirectory: (directoryPath: string, projectId?: string) =>
    ipcRenderer.invoke('fs:watch', directoryPath, projectId),

  unwatchDirectory: (directoryPath: string) =>
    ipcRenderer.invoke('fs:unwatch', directoryPath),

  onDirectoryChanged: (callback: (data: FsWatchEvent) => void) => {
    const handler = (_: any, data: FsWatchEvent) => callback(data);
    ipcRenderer.on('fs:changed', handler);
    return () => ipcRenderer.removeListener('fs:changed', handler);
  },

  // ── Oto-Kilit İstihbaratı (FAZ 2.3) ─────────────────────────────
  onFileLockChanged: (callback: (data: FileLockEvent) => void) => {
    const handler = (_: any, data: FileLockEvent) => callback(data);
    ipcRenderer.on('fs:lockChanged', handler);
    return () => ipcRenderer.removeListener('fs:lockChanged', handler);
  },

  // ── Dosya Açma (FAZ 2.4) ────────────────────────────────────────
  openFile: (filePath: string) =>
    ipcRenderer.invoke('fs:openFile', filePath),

  // ── Dosya Kopyalama (FAZ 2.4) ───────────────────────────────────
  copyFiles: (destDir: string, filePaths: string[]) =>
    ipcRenderer.invoke('fs:copyFiles', destDir, filePaths),

  // ── Dosya İndirme (Cross-origin) ────────────────────────────────
  downloadFile: (url: string, filename: string) =>
    ipcRenderer.invoke('file:download', url, filename),

  // ── Versiyon Yönetimi (FAZ 2.5) ─────────────────────────────────
  listFileVersions: (projectId: string, fileId: string) =>
    ipcRenderer.invoke('version:list', projectId, fileId),

  restoreFileVersion: (projectId: string, versionId: string, localDirPath?: string) =>
    ipcRenderer.invoke('version:restore', projectId, versionId, localDirPath),

  updateVersionNote: (request: VersionNoteRequest) =>
    ipcRenderer.invoke('version:note', request),
});
