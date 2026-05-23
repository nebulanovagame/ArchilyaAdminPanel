import { type User, type UserCredential } from 'firebase/auth';
import { type Timestamp } from 'firebase/firestore';

// ============================================================================
// AUTH & USER
// ============================================================================

export interface UserProfile {
  uid?: string;
  email?: string | null;
  name?: string;
  displayName?: string | null;
  credits?: number;
  plan?: string;
  creditHistory?: CreditHistoryEntry[];
  [key: string]: unknown;
}

export interface AuthContextType {
  user: User | null;
  userData: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<UserCredential>;
  signInWithGoogleToken: (tokens: { idToken?: string; accessToken?: string }) => Promise<UserCredential>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: (uid: string) => Promise<void>;
}

// ============================================================================
// WORKSPACE
// ============================================================================

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
}

export interface Workspace {
  id: string;
  adminUid?: string;
  memberUids?: string[];
  members?: WorkspaceMember[];
  name?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

export interface WorkspaceInvite {
  id: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  fromUid?: string;
  fromName?: string;
  fromEmail?: string;
  workspaceId?: string;
  workspaceName?: string;
  createdAt: Date;
  [key: string]: unknown;
}

export interface WorkspaceContextType {
  adminWorkspace: Workspace | null;
  memberWorkspace: Workspace | null;
  activeWorkspace: Workspace | null;
  workspaceInvites: WorkspaceInvite[];
  isAdmin: boolean;
  loading: boolean;
  createWorkspace: (name: string) => Promise<{ success: boolean; message?: string }>;
  inviteMember: (toEmail: string) => Promise<{ success: boolean; message?: string }>;
  acceptWorkspaceInvite: (inviteId: string) => Promise<{ success: boolean; message?: string }>;
  declineWorkspaceInvite: (inviteId: string) => Promise<{ success: boolean; message?: string }>;
  removeMember: (memberUid: string) => Promise<{ success: boolean; message?: string }>;
  deleteWorkspace: () => Promise<{ success: boolean; message?: string }>;
}

// ============================================================================
// PROJECTS
// ============================================================================

export interface UploadSignal {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  size: number;
  contentType: string;
  folderId: string | null;
  storageProvider: 'firebase' | 'r2';
  phase: 'pending_binary' | 'pending_commit';
  status: 'uploading' | 'failed';
  createdAt: string;
  updatedAt: string;
  lastError: string;
}

export interface Project {
  id: string;
  ownerId: string;
  memberUids: string[];
  name: string;
  location?: string;
  status: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
  uploadSignals?: UploadSignal[];
  [key: string]: unknown;
}

export interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  error: string | null;
  addProject: (projectData: { name: string; location?: string; status?: string }) => Promise<{ success: boolean; message?: string; project?: Project; projectId?: string }>;
  updateProject: (projectId: string, data: Partial<Project>) => Promise<{ success: boolean; message?: string }>;
  deleteProject: (projectId: string) => Promise<{ success: boolean; message?: string }>;
  restoreProject: (projectId: string) => Promise<{ success: boolean; message?: string }>;
  hardDeleteProject: (projectId: string) => Promise<{ success: boolean; message?: string }>;
}

// ============================================================================
// CREDITS
// ============================================================================

export interface CreditHistoryEntry {
  type: 'spend' | 'load';
  amount: number;
  description: string;
  createdAt: Date;
}

export interface CreditTransactionItem {
  id: string;
  type: 'spend' | 'load';
  amount: number;
  description: string;
  createdAt: Date | null;
}

export interface CreditsContextType {
  credits: number | null;
  plan: string;
  creditHistory: CreditHistoryEntry[];
  creditTransactions: CreditTransactionItem[];
  creditTransactionsLoading: boolean;
  creditTransactionsLoaded: boolean;
  creditTransactionsError: string;
  loading: boolean;
  deductCredits: (amount: number, description?: string) => Promise<void>;
  addCredits: (amount: number, description?: string) => Promise<void>;
  hasEnough: (amount: number) => boolean;
  refetchCredits: () => Promise<UserProfile | null>;
  fetchCreditTransactions: (force?: boolean) => Promise<CreditTransactionItem[]>;
}

// ============================================================================
// NOTIFICATIONS & INVITATIONS
// ============================================================================

export interface AppNotification {
  id: string;
  toEmail: string;
  title?: string;
  body?: string;
  projectId?: string;
  read: boolean;
  type?: string;
  createdAt: Date;
  [key: string]: unknown;
}

export interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (notifId: string) => Promise<{ success: boolean; message?: string }>;
  markAllAsRead: () => Promise<{ success: boolean; message?: string }>;
}

export interface Invitation {
  id: string;
  fromUid: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  projectId?: string;
  projectName?: string;
  role?: string;
  fromName?: string;
  createdAt: Date;
  [key: string]: unknown;
}

export interface InvitationsContextType {
  sentInvites: Invitation[];
  receivedInvites: Invitation[];
  loading: boolean;
  sendInvite: (params: { toEmail: string; projectId: string; projectName?: string; role?: string }) => Promise<{ success: boolean; message?: string }>;
  acceptInvite: (invite: Invitation) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

export interface LastNotificationResponse {
  receivedAt: number;
  data: Record<string, unknown>;
  title: string;
  body: string;
}

export interface PushNotificationsContextType {
  pushToken: string;
  pushError: string;
  lastNotification: Record<string, unknown> | null;
  lastNotificationResponse: LastNotificationResponse | null;
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

export interface FileUploadContextType {
  uploadFile: (file: File | Blob, projectId: string, onProgress?: (percent: number) => void) => Promise<UploadResult>;
  cancelUpload: () => void;
}

// ============================================================================
// AI HISTORY
// ============================================================================

export interface SceneReferenceEntry {
  uri: string;
  mimeType: string;
  type: string;
  label: string;
  note: string;
}

export interface AiHistoryEntry {
  id: string;
  uid?: string;
  email?: string | null;
  toolId?: string;
  toolLabel?: string;
  outputType?: string;
  mode?: string;
  style?: string;
  workflow?: string;
  promptRaw?: string;
  promptPreview?: string;
  sourceImageName?: string;
  sourceImageMimeType?: string;
  sourceImageUri?: string;
  sourceProjectId?: string;
  sceneReferences?: SceneReferenceEntry[];
  status?: string;
  errorMessage?: string | null;
  resultTextPreview?: string | null;
  hasImageResult?: boolean;
  resultMimeType?: string | null;
  savedProjectId?: string | null;
  savedProjectName?: string | null;
  savedFileUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  savedAt?: Date | null;
}

export type AiHistoryPayload = Partial<Omit<AiHistoryEntry, 'createdAt' | 'updatedAt' | 'savedAt'>> & {
  createdAt?: Date | string;
  updatedAt?: Date | string;
  savedAt?: Date | string | null;
  [key: string]: unknown;
};

export interface AiHistoryContextType {
  history: AiHistoryEntry[];
  recentHistory: AiHistoryEntry[];
  loading: boolean;
  historyWritable: boolean;
  logAiHistory: (payload: AiHistoryPayload) => Promise<string>;
  updateAiHistoryEntry: (historyId: string, data: AiHistoryPayload) => Promise<void>;
}

// ============================================================================
// MEDIA & PICKED FILES
// ============================================================================

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

// ============================================================================
// CALLABLE RESPONSES
// ============================================================================

export interface CallableResponse<T = Record<string, unknown>> {
  success: boolean;
  message?: string;
  data?: T;
}

// ============================================================================
// EXPO / PLATFORM
// ============================================================================

export interface ExpoExtraConfig {
  billing?: { checkoutUrl?: string };
  googleAuth?: Record<string, string>;
  eas?: { projectId?: string };
}
