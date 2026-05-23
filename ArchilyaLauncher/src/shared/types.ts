import type { LaunchRequest } from './launchProfiles';
import type { WebShareStartRequest, WebShareStartResult, WebShareStatus } from './streamingTypes';
import type { MachineIdentityInfo, RemoteCommandHistoryEntry } from './remoteCommandTypes';
import type { AiGenerateRequest, AiGenerateResponse, AiJobStatusResponse, AiJobProgressEvent, AiJobCompleteEvent } from './aiTypes';
import type { FsListResponse, FsWatchEvent, FileLockEvent } from './fsTypes';
import type { VersionListResponse, VersionRestoreResponse, VersionNoteRequest } from './versionTypes';

// ════════════════════════════════════════════════════════════
// OYUN ENGINE TİPLERİ (launcher güncelleme sistemi)
// ════════════════════════════════════════════════════════════

export interface GameManifestPart {
  url:  string;
  size: number;
}

export interface GameManifest {
  version:             string;
  buildDate:           string;
  downloadUrl?:        string;
  downloadParts?:      GameManifestPart[];
  totalSize?:          number;
  zipHash:             string;
  executableName:      string;
  maintenanceMode:     boolean;
  maintenanceMessage:  string;
  patchNotes:          string[];
}

export interface GameUpdateCheckResult {
  status:          'offline-ready' | 'error' | 'maintenance' | 'not-installed' | 'update-available' | 'ready';
  message?:        string;
  remoteManifest?: GameManifest;
  localVersion?:   string;
}

// ════════════════════════════════════════════════════════════
// AUTH TİPLERİ
// ════════════════════════════════════════════════════════════

export interface UserData {
  uid:          string;
  email:        string;
  displayName:  string;
  photoURL:     string | null;
  isGuest:      boolean;
  emailVerified: boolean;
}

export interface AuthResponse {
  success:  boolean;
  user?:    UserData;
  error?:   string;
  message?: string;
}

// ════════════════════════════════════════════════════════════
// VR PROJELERİ (Firestore users/{uid}/owned_project_ids → products/{id})
// PAK dosyalarını içeren indirilebilir oyun projeleri
// ════════════════════════════════════════════════════════════

export interface VrProjectFile {
  name: string;
  url: string;
  size: number;
  storageProvider?: string;
  objectKey?: string | null;
  contentType?: string;
}

export interface VrProject {
  id:       string;
  title:    string;
  map_name: string;
  vrMapName?: string;
  webShareMapName?: string;
  category?: string;
  isBuiltInDemo?: boolean;
  isPublicDemo?: boolean;
  isEmbedded?: boolean;
  files:    VrProjectFile[];
}

export type VrProjectStatus = 'NOT_INSTALLED' | 'INSTALLED' | 'DOWNLOADING';

// ════════════════════════════════════════════════════════════
// MİMARİ DOSYALAR — Web panelinden yönetilir, files[] alanında
// ════════════════════════════════════════════════════════════

export interface ProjectFile {
  name:        string;
  url:         string;
  path:        string | null;
  size:        number;
  type:        string;   // 'pdf' | 'dwg' | 'jpg' | 'png' | ...
  folderId:    string | null;
  createdAt:   string;
  uploadedBy?: string;
  storageProvider?: 'firebase' | 'r2';
  objectKey?: string | null;
  contentType?: string;
  status?:     'active' | 'trashed';
  deletedAt?:  string | null;
  deletedBy?:  string;
}

// ════════════════════════════════════════════════════════════
// PAK / VR BUILD SİSTEMİ — SADECE LAUNCHER okur/yazar
// Web panelinden görünmez, silinemez, değiştirilemez.
// Firestore'da: projects/{id}/pak_files[]
// ════════════════════════════════════════════════════════════

export interface PakFile {
  name:      string;   // "MyProject_v2.pak"
  url:       string;   // İndirme URL'i (Storage veya CDN)
  size:      number;   // Byte cinsinden boyut
  version:   string;   // "1.0.0" — versiyon takibi için
  hash:      string;   // MD5/SHA256 — bütünlük kontrolü için
  createdAt: string;   // ISO tarih
}

export interface VrBuild {
  map_name:    string;     // Unreal Engine level adı (örn: "L_VillaNoir")
  version:     string;     // "1.0.0"
  pak_files:   PakFile[];  // Bu build'e ait indirilebilir PAK listesi
  description: string;     // "v1.0 - İlk versiyon"
  createdAt:   string;     // ISO tarih
  isActive:    boolean;    // Hangi build aktif (birden fazla build olabilir)
}

// PAK indirme durumu (her proje kartı için ayrı state)
export type PakStatus =
  | 'checking'       // disk kontrol ediliyor
  | 'not-installed'  // hiç indirilmemiş
  | 'downloading'    // şu an indiriliyor
  | 'installed'      // kurulu ve oynamaya hazır
  | 'update-available' // yeni versiyon var
  | 'error';         // bir şeyler ters gitti

export interface PakDownloadProgress {
  projectId: string;
  progress:  number;   // 0-100
  status:    string;   // kullanıcıya gösterilecek mesaj
}

export interface CheckPakStatusResult {
  status:           PakStatus;
  installedVersion: string | null;  // kurulu versiyon
  latestVersion:    string | null;  // Firestore'daki en son versiyon
}

export interface LaunchProjectResult {
  success:  boolean;
  message?: string;
}

export interface LaunchArchilyaResult {
  success: boolean;
  message?: string;
}

// ════════════════════════════════════════════════════════════
// PROJE TİPLERİ (Firebase yapısıyla tam uyumlu)
// ════════════════════════════════════════════════════════════

export type FirebaseProjectStatus = 'Aktif' | 'Taslak' | 'İncelemede' | 'Tamamlandı';

export interface ActivityEntry {
  action:    string;
  user:      string;
  timestamp: string;
  details:   string;
}

export interface FirebaseProject {
  id:           string;
  name:         string;
  description:  string;
  status:       FirebaseProjectStatus;
  location:     string;
  uid:          string;
  memberUids:   string[];
  team?:        { uid: string; email: string; role: string }[];

  // ── Mimari dosyalar (web panelinden yönetilir) ──
  files:        ProjectFile[];
  deletedFiles: ProjectFile[];
  fileCount:    { pdf: number; dwg: number; img: number };
  totalSize:    number;

  // ── PAK/VR Build sistemi (SADECE Launcher yönetir) ──
  pak_files:    PakFile[];    // aktif build'in PAK listesi (kısa yol erişim)
  map_name:     string;       // aktif build'in level adı
  vr_builds:    VrBuild[];    // tüm build geçmişi ve versiyonları

  activityLog:  ActivityEntry[];
  isDeleted:    boolean;
  createdAt:    Date;
  updatedAt:    Date;
}

export interface CreateProjectData {
  name:        string;
  description: string;
  status:      FirebaseProjectStatus;
  location:    string;
}

// ════════════════════════════════════════════════════════════
// DOSYA UPLOAD EVENTLERİ
// ════════════════════════════════════════════════════════════

export interface UploadProgressData {
  fileName:  string;
  projectId: string;
  percent:   number;
}

export interface UploadCompleteData {
  fileName:    string;
  projectId:   string;
  downloadUrl: string;
}

export interface UploadErrorData {
  fileName:  string;
  projectId: string;
  error:     string;
}

export interface SyncStatus {
  projectId: string;
  status: 'idle' | 'syncing' | 'error' | 'up-to-date';
  lastSync: string;
  pendingChanges: number;
  progress?: number;
  progressBytes?: number;
  totalBytes?: number;
  currentFile?: string;
  retryCount?: number;
  isResumable?: boolean;
}

export interface LauncherSettings {
  autoStart: boolean;
  backgroundSync: boolean;
  wifiOnly: boolean;
  notifSync: boolean;
  notifLock: boolean;
  notifProject: boolean;
  notifSystem: boolean;
  syncSpeed: SyncSpeedLimit;
  themeMode: ThemeMode;
  storagePath: string;
}

export interface SettingsResponse {
  success: boolean;
  settings?: LauncherSettings;
  error?: string;
}

// ════════════════════════════════════════════════════════════
// ELECTRON API TİPİ (window.api)
// ════════════════════════════════════════════════════════════

export interface IElectronAPI {

  // ── Pencere ──────────────────────────────────────────────
  minimize:       () => void;
  close:          () => void;
  getAppVersion:  () => Promise<string>;

  // ── Auth ─────────────────────────────────────────────────
  login:          (email: string, password: string, rememberMe: boolean) => Promise<AuthResponse>;
  loginWithGoogle:(rememberMe: boolean) => Promise<AuthResponse>;
  register:       (email: string, password: string) => Promise<AuthResponse>;
  logout:         () => Promise<{ success: boolean }>;
  loginGuest:     () => Promise<AuthResponse>;
  resetPassword:  (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  checkSession:   () => Promise<UserData | null>;
  getSavedEmail:  () => Promise<string>;

  // ── Ayarlar ───────────────────────────────────────────────
  getSettings:    () => Promise<SettingsResponse>;
  updateSettings: (settings: Partial<LauncherSettings>) => Promise<SettingsResponse>;

  // ── Firebase Proje Yönetimi ───────────────────────────────
  subscribeProjects:   (uid: string) => Promise<{ success: boolean }>;
  unsubscribeProjects: () => Promise<{ success: boolean }>;
  addProject:     (data: CreateProjectData) => Promise<{ success: boolean; id?: string; error?: string }>;
  updateProject:  (projectId: string, data: Partial<CreateProjectData>) => Promise<{ success: boolean; error?: string }>;
  deleteProject:  (projectId: string) => Promise<{ success: boolean; error?: string }>;
  onProjectsChanged: (callback: (projects: FirebaseProject[]) => void) => () => void;
  onProjectsError:   (callback: (error: string) => void) => () => void;

  // ── Mimari Dosya Yönetimi (web paneli dosyaları) ─────────
  uploadFile:     (projectId: string) => Promise<{ success: boolean; count?: number; canceled?: boolean; error?: string }>;
  deleteFile:     (projectId: string, file: ProjectFile) => Promise<{ success: boolean; error?: string }>;
  onUploadProgress: (callback: (data: UploadProgressData) => void) => () => void;
  onUploadComplete: (callback: (data: UploadCompleteData) => void) => () => void;
  onUploadError:    (callback: (data: UploadErrorData) => void) => () => void;

  // ── Dosya Senkronizasyonu ──────────────────────────────────
  getLocalProjectPath: (projectId: string) => Promise<string>;
  syncProject: (projectId: string) => Promise<void>;
  syncAllProjects: () => Promise<void>;
  getSyncStatus: (projectId: string) => Promise<SyncStatus>;
  openProjectFolder: (projectId: string) => Promise<void>;
  setSyncFolder: () => Promise<string>;
  onSyncProgress: (callback: (data: SyncStatus) => void) => () => void;
  onFileChanged: (callback: (data: { projectId: string; file: string; action: string }) => void) => () => void;
  notifySyncOnline: () => Promise<void>;
  notifySyncFocus: () => Promise<void>;

  // ── VR Projeler (owned_project_ids → products) ────────────
  getProjects:        () => Promise<VrProject[]>;
  checkProjectStatus: (project: VrProject) => Promise<VrProjectStatus>;
  downloadProject:    (project: VrProject) => Promise<{ success: boolean; message?: string }>;
  cancelProjectDownload: (projectId: string) => Promise<boolean>;
  deleteProject_VR:   (project: VrProject) => Promise<{ success: boolean; message?: string }>;
  launchVrProject:      (projectId: string, mapName: string) => Promise<{ success: boolean; message?: string }>;
  onProjectProgress:  (callback: (data: { projectId: string; progress: number; status: string }) => void) => () => void;
  onProjectsUpdated:  (callback: (projects: VrProject[]) => void) => () => void;

  // ── PAK / VR Build Sistemi (Firebase projects için) ──────
  checkPakStatus: (projectId: string, pakFiles: PakFile[], currentVersion: string) => Promise<CheckPakStatusResult>;
  downloadPak:    (projectId: string, pakFiles: PakFile[]) => Promise<{ success: boolean; error?: string }>;
  cancelPakDownload: (projectId: string) => Promise<void>;
  launchProjectPak:  (projectId: string, mapName: string) => Promise<LaunchProjectResult>;
  launchArchilya: (request: LaunchRequest) => Promise<LaunchArchilyaResult>;
  startWebShare: (request: WebShareStartRequest) => Promise<WebShareStartResult>;
  stopWebShare: () => Promise<{ success: boolean; message?: string }>;
  getWebShareStatus: () => Promise<WebShareStatus>;
  getMachineIdentity: () => Promise<MachineIdentityInfo>;
  getRemoteCommandHistory: (limit?: number) => Promise<RemoteCommandHistoryEntry[]>;
  onPakDownloadProgress: (callback: (data: PakDownloadProgress) => void) => () => void;
  onPakDownloadComplete: (callback: (data: { projectId: string; success: boolean }) => void) => () => void;
  onPakDownloadError:    (callback: (data: { projectId: string; message: string }) => void) => () => void;

  // ── Oyun Engine Güncelleme (launcher-wide, tüm projeler için) ──
  checkGameUpdate:       () => Promise<GameUpdateCheckResult>;
  startGameUpdate:       (manifest: GameManifest) => void;
  launchGame:            () => Promise<{ success: boolean; message?: string }>;
  onGameUpdateProgress:  (callback: (data: { step: string; progress: number; status: string }) => void) => () => void;
  onGameUpdateComplete:  (callback: (data: { success: boolean }) => void) => () => void;
  onGameUpdateError:     (callback: (data: { message: string }) => void) => () => void;
  onGameUpdateAvailable: (callback: (manifest: GameManifest) => void) => () => void;
  onLauncherUpdateStatus:(callback: (data: { status: string; progress?: number; message?: string }) => void) => () => void;
  onGameStatusChanged:   (callback: (isRunning: boolean) => void) => () => void;

  // ── AI Motor (FAZ 2.1) ──────────────────────────────────
  createAiJob: (request: AiGenerateRequest) => Promise<AiGenerateResponse>;
  checkAiJobStatus: (jobId: string) => Promise<AiJobStatusResponse>;
  cancelAiJob: (jobId: string) => Promise<{ success: boolean }>;
  onAiJobProgress: (callback: (data: AiJobProgressEvent) => void) => () => void;
  onAiJobComplete: (callback: (data: AiJobCompleteEvent) => void) => () => void;

  // ── Dosya Sistemi (FAZ 2.2) ───────────────────────────────
  listDirectory:    (directoryPath: string) => Promise<FsListResponse>;
  watchDirectory:   (directoryPath: string, projectId?: string) => Promise<{ success: boolean; error?: string }>;
  unwatchDirectory: (directoryPath: string) => Promise<{ success: boolean }>;
  onDirectoryChanged: (callback: (data: FsWatchEvent) => void) => () => void;

  // ── Oto-Kilit İstihbaratı (FAZ 2.3) ───────────────────────
  onFileLockChanged: (callback: (data: FileLockEvent) => void) => () => void;

  // ── Dosya Açma (FAZ 2.4) ─────────────────────────────────
  openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;

  // ── Dosya Kopyalama (FAZ 2.4) ─────────────────────────────
  copyFiles: (destDir: string, filePaths: string[]) => Promise<{ success: boolean; copied?: string[]; error?: string }>;

  // ── Dosya İndirme (Cross-origin) ──────────────────────────
  downloadFile: (url: string, filename: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;

  // ── Versiyon Yönetimi (FAZ 2.5) ──────────────────────────
  listFileVersions: (projectId: string, fileId: string) => Promise<VersionListResponse>;
  restoreFileVersion: (projectId: string, versionId: string, localDirPath?: string) => Promise<VersionRestoreResponse>;
  updateVersionNote: (request: VersionNoteRequest) => Promise<{ success: boolean; error?: string }>;
}

// ════════════════════════════════════════════════════════════
// KURUMSAL / EKİP TİPLERİ (Faz 1.19)
// ════════════════════════════════════════════════════════════

export type TeamRole = 'Tasarımcı' | 'Admin' | 'Stajyer' | 'Müşteri';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  initials: string;
  avatarColor: string;
  status: 'online' | 'offline' | 'busy';
}

export type VisibilityLevel = 'team' | 'admin' | 'client';

export type SyncSpeedLimit = 'unlimited' | '5mbps' | '1mbps';

export type ThemeMode = 'dark' | 'light' | 'system';

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
