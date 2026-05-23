import {
  getFunctions,
  httpsCallable,
  type Functions,
  type HttpsCallable,
  type HttpsCallableResult,
} from 'firebase/functions';
import { app } from '../config/firebase';
import { type AiHistoryPayload, type CallableResponse, type Project, type UserProfile } from '../types';
import { captureException } from './errorTracking';

type UnknownRecord = Record<string, unknown>;
type EmptyPayload = Record<string, never>;
type SecureResponse<T = UnknownRecord> = CallableResponse<T> & UnknownRecord;
type SecureCallable<P, R extends SecureResponse> = HttpsCallable<P, R>;

type EnsureUserProfilePayload = {
  email?: string | null;
  displayName?: string | null;
} & UnknownRecord;

type CreditsPayload = {
  amount: number;
  description?: string;
};

type UpgradeSubscriptionPayload = {
  planId: string;
  paymentVerified: boolean;
};

type CreateWorkspacePayload = {
  name: string;
  displayName?: string;
  email?: string | null;
};

type WorkspaceIdPayload = {
  workspaceId: string;
};

type InviteWorkspaceMemberPayload = WorkspaceIdPayload & {
  toEmail: string;
};

type WorkspaceInvitePayload = {
  inviteId: string;
};

type RemoveWorkspaceMemberPayload = WorkspaceIdPayload & {
  memberUid: string;
};

type CreateProjectPayload = {
  name?: string;
  location?: string;
  status?: string;
  displayName?: string;
  email?: string | null;
} & UnknownRecord;

type UpdateProjectData = UnknownRecord;

type UpdateProjectPayload = {
  projectId: string;
  data: UpdateProjectData;
};

type ProjectInvitePayload = {
  toEmail?: string;
  projectId?: string;
  projectName?: string;
  role?: string;
} & UnknownRecord;

type InviteIdPayload = {
  inviteId: string;
};

type ProjectIdPayload = {
  projectId: string;
};

type ProjectFileUrlPayload = ProjectIdPayload & {
  fileUrl: string;
};

type CreateProjectFolderPayload = ProjectIdPayload & {
  folderName: string;
  folderId: string;
};

export type ProjectFilePayload = {
  name?: string;
  size?: number;
  type?: string;
  url?: string;
  path?: string | null;
  storageProvider?: 'firebase' | 'r2' | string;
  objectKey?: string | null;
  contentType?: string;
  folderId?: string | null;
  createdAt?: string;
} & UnknownRecord;

type AddProjectFilePayload = ProjectIdPayload & {
  file: ProjectFilePayload;
};

type SaveAiOutputPayload = {
  projectId?: string;
  folderId?: string | null;
  fileName?: string;
  dataUrl?: string;
  mimeType?: string;
} & UnknownRecord;

type PushTokenPayload = {
  token: string;
};

type NotificationIdPayload = {
  notifId: string;
};

type LogAiHistoryPayload = {
  payload: AiHistoryPayload;
};

type UpdateAiHistoryPayload = {
  historyId: string;
  data: AiHistoryPayload;
};

type SaveAiPromptHistoryPayload = {
  toolId: string;
  entry: UnknownRecord;
};

export type UserProfileResponse = SecureResponse<UserProfile>;
export type WorkspaceResponse = SecureResponse & {
  workspaceId?: string;
  workspace?: UnknownRecord | null;
};
export type ProjectMutationResponse = SecureResponse<Project> & {
  project?: Project | null;
  projectId?: string;
};
export type FolderMutationResponse = SecureResponse & {
  folder?: { id?: string; name?: string } & UnknownRecord;
};
export type ProjectFileMutationResponse = SecureResponse & {
  file?: ProjectFilePayload | null;
};
export type PromptHistoryResponse = SecureResponse & {
  history?: Record<string, UnknownRecord[]>;
};

const functions: Functions = getFunctions(app, 'europe-west1');

const createCallable = <P, R extends SecureResponse>(name: string): SecureCallable<P, R> =>
  httpsCallable<P, R>(functions, name);

const ensureUserProfileCallable = createCallable<EnsureUserProfilePayload, UserProfileResponse>('ensureUserProfile');
const deductCreditsCallable = createCallable<CreditsPayload, SecureResponse>('deductCredits');
const refundCreditsCallable = createCallable<CreditsPayload, SecureResponse>('refundCredits');
const upgradeSubscriptionCallable = createCallable<UpgradeSubscriptionPayload, SecureResponse>('upgradeSubscription');
const createWorkspaceSecureCallable = createCallable<CreateWorkspacePayload, WorkspaceResponse>('createWorkspaceSecure');
const inviteWorkspaceMemberSecureCallable = createCallable<InviteWorkspaceMemberPayload, SecureResponse>('inviteWorkspaceMemberSecure');
const acceptWorkspaceInviteSecureCallable = createCallable<WorkspaceInvitePayload, SecureResponse>('acceptWorkspaceInviteSecure');
const declineWorkspaceInviteSecureCallable = createCallable<WorkspaceInvitePayload, SecureResponse>('declineWorkspaceInviteSecure');
const removeWorkspaceMemberSecureCallable = createCallable<RemoveWorkspaceMemberPayload, SecureResponse>('removeWorkspaceMemberSecure');
const deleteWorkspaceSecureCallable = createCallable<WorkspaceIdPayload, SecureResponse>('deleteWorkspaceSecure');
const createProjectSecureCallable = createCallable<CreateProjectPayload, ProjectMutationResponse>('createProjectSecure');
const updateProjectSecureCallable = createCallable<UpdateProjectPayload, ProjectMutationResponse>('updateProjectSecure');
const sendProjectInviteSecureCallable = createCallable<ProjectInvitePayload, SecureResponse>('sendProjectInviteSecure');
const acceptProjectInviteSecureCallable = createCallable<InviteIdPayload, SecureResponse>('acceptProjectInviteSecure');
const declineProjectInviteSecureCallable = createCallable<InviteIdPayload, SecureResponse>('declineProjectInviteSecure');
const softDeleteProjectSecureCallable = createCallable<ProjectIdPayload, SecureResponse>('softDeleteProjectSecure');
const restoreProjectSecureCallable = createCallable<ProjectIdPayload, SecureResponse>('restoreProjectSecure');
const hardDeleteProjectSecureCallable = createCallable<ProjectIdPayload, SecureResponse>('hardDeleteProjectSecure');
const restoreProjectFileSecureCallable = createCallable<ProjectFileUrlPayload, SecureResponse>('restoreProjectFileSecure');
const permanentlyDeleteProjectFileSecureCallable = createCallable<ProjectFileUrlPayload, SecureResponse>('permanentlyDeleteProjectFileSecure');
const createProjectFolderSecureCallable = createCallable<CreateProjectFolderPayload, FolderMutationResponse>('createProjectFolderSecure');
const addProjectFileSecureCallable = createCallable<AddProjectFilePayload, ProjectFileMutationResponse>('addProjectFileSecure');
const moveProjectFileToTrashSecureCallable = createCallable<ProjectFileUrlPayload, SecureResponse>('moveProjectFileToTrashSecure');
const saveAiOutputToProjectSecureCallable = createCallable<SaveAiOutputPayload, ProjectFileMutationResponse>('saveAiOutputToProjectSecure');
const registerPushTokenSecureCallable = createCallable<PushTokenPayload, SecureResponse>('registerPushTokenSecure');
const markNotificationReadSecureCallable = createCallable<NotificationIdPayload, SecureResponse>('markNotificationReadSecure');
const markAllNotificationsReadSecureCallable = createCallable<EmptyPayload, SecureResponse>('markAllNotificationsReadSecure');
const logAiHistoryEntrySecureCallable = createCallable<LogAiHistoryPayload, SecureResponse & { historyId?: string }>('logAiHistoryEntrySecure');
const updateAiHistoryEntrySecureCallable = createCallable<UpdateAiHistoryPayload, SecureResponse>('updateAiHistoryEntrySecure');
const getAiPromptHistorySecureCallable = createCallable<EmptyPayload, PromptHistoryResponse>('getAiPromptHistorySecure');
const saveAiPromptHistorySecureCallable = createCallable<SaveAiPromptHistoryPayload, PromptHistoryResponse>('saveAiPromptHistorySecure');
const deleteAccountSecureCallable = createCallable<EmptyPayload, SecureResponse>('deleteAccountSecure');

function defaultResponse<R extends SecureResponse>(): R {
  return { success: false } as R;
}

async function callSecure<P, R extends SecureResponse>(callable: SecureCallable<P, R>, payload: P, fallback?: R): Promise<R> {
  try {
    const result = await callable(payload);
    return extractCallableData(result, fallback);
  } catch (error) {
    captureException(error, { scope: 'mobile_cloud_function' });
    throw error;
  }
}

export function extractCallableData<R extends SecureResponse = SecureResponse>(
  result: HttpsCallableResult<R> | { data?: R } | null | undefined,
  fallback?: R
): R {
  return result?.data || fallback || defaultResponse<R>();
}

export async function ensureUserProfileSecure(payload: EnsureUserProfilePayload = {}): Promise<UserProfileResponse> {
  return await callSecure(ensureUserProfileCallable, payload);
}

export async function deductCreditsSecure(amount: number, description?: string): Promise<SecureResponse> {
  return await callSecure(deductCreditsCallable, { amount, description });
}

export async function refundCreditsSecure(amount: number, description?: string): Promise<SecureResponse> {
  return await callSecure(refundCreditsCallable, { amount, description });
}

export async function upgradeSubscriptionSecure(planId: string, paymentVerified = false): Promise<SecureResponse> {
  return await callSecure(upgradeSubscriptionCallable, {
    planId,
    paymentVerified,
  });
}

export async function createWorkspaceSecure(name: string, displayName = '', email?: string | null): Promise<WorkspaceResponse> {
  return await callSecure(createWorkspaceSecureCallable, { name, displayName, email });
}

export async function inviteWorkspaceMemberSecure(workspaceId: string, toEmail: string): Promise<SecureResponse> {
  return await callSecure(inviteWorkspaceMemberSecureCallable, { workspaceId, toEmail });
}

export async function acceptWorkspaceInviteSecure(inviteId: string): Promise<SecureResponse> {
  return await callSecure(acceptWorkspaceInviteSecureCallable, { inviteId });
}

export async function declineWorkspaceInviteSecure(inviteId: string): Promise<SecureResponse> {
  return await callSecure(declineWorkspaceInviteSecureCallable, { inviteId });
}

export async function removeWorkspaceMemberSecure(workspaceId: string, memberUid: string): Promise<SecureResponse> {
  return await callSecure(removeWorkspaceMemberSecureCallable, { workspaceId, memberUid });
}

export async function deleteWorkspaceSecure(workspaceId: string): Promise<SecureResponse> {
  return await callSecure(deleteWorkspaceSecureCallable, { workspaceId });
}

export async function createProjectSecure(payload: CreateProjectPayload = {}): Promise<ProjectMutationResponse> {
  return await callSecure(createProjectSecureCallable, payload || {});
}

export async function updateProjectSecure(projectId: string, data: UpdateProjectData = {}): Promise<ProjectMutationResponse> {
  return await callSecure(updateProjectSecureCallable, { projectId, data: data || {} });
}

export async function sendProjectInviteSecure(payload: ProjectInvitePayload): Promise<SecureResponse> {
  return await callSecure(sendProjectInviteSecureCallable, payload || {});
}

export async function acceptProjectInviteSecure(inviteId: string): Promise<SecureResponse> {
  return await callSecure(acceptProjectInviteSecureCallable, { inviteId });
}

export async function declineProjectInviteSecure(inviteId: string): Promise<SecureResponse> {
  return await callSecure(declineProjectInviteSecureCallable, { inviteId });
}

export async function softDeleteProjectSecure(projectId: string): Promise<SecureResponse> {
  return await callSecure(softDeleteProjectSecureCallable, { projectId });
}

export async function restoreProjectSecure(projectId: string): Promise<SecureResponse> {
  return await callSecure(restoreProjectSecureCallable, { projectId });
}

export async function hardDeleteProjectSecure(projectId: string): Promise<SecureResponse> {
  return await callSecure(hardDeleteProjectSecureCallable, { projectId });
}

export async function restoreProjectFileSecure(projectId: string, fileUrl: string): Promise<SecureResponse> {
  return await callSecure(restoreProjectFileSecureCallable, { projectId, fileUrl });
}

export async function permanentlyDeleteProjectFileSecure(projectId: string, fileUrl: string): Promise<SecureResponse> {
  return await callSecure(permanentlyDeleteProjectFileSecureCallable, { projectId, fileUrl });
}

export async function createProjectFolderSecure(projectId: string, folderName: string, folderId = ''): Promise<FolderMutationResponse> {
  return await callSecure(createProjectFolderSecureCallable, { projectId, folderName, folderId });
}

export async function addProjectFileSecure(projectId: string, file: ProjectFilePayload): Promise<ProjectFileMutationResponse> {
  return await callSecure(addProjectFileSecureCallable, { projectId, file });
}

export async function moveProjectFileToTrashSecure(projectId: string, fileUrl: string): Promise<SecureResponse> {
  return await callSecure(moveProjectFileToTrashSecureCallable, { projectId, fileUrl });
}

export async function saveAiOutputToProjectSecure(payload: SaveAiOutputPayload): Promise<ProjectFileMutationResponse> {
  return await callSecure(saveAiOutputToProjectSecureCallable, payload || {});
}

export async function registerPushTokenSecure(token: string): Promise<SecureResponse> {
  return await callSecure(registerPushTokenSecureCallable, { token });
}

export async function markNotificationReadSecure(notifId: string): Promise<SecureResponse> {
  return await callSecure(markNotificationReadSecureCallable, { notifId });
}

export async function markAllNotificationsReadSecure(): Promise<SecureResponse> {
  return await callSecure(markAllNotificationsReadSecureCallable, {});
}

export async function logAiHistoryEntrySecure(payload: AiHistoryPayload = {}): Promise<SecureResponse & { historyId?: string }> {
  return await callSecure(logAiHistoryEntrySecureCallable, { payload: payload || {} });
}

export async function updateAiHistoryEntrySecure(historyId: string, data: AiHistoryPayload = {}): Promise<SecureResponse> {
  return await callSecure(updateAiHistoryEntrySecureCallable, { historyId, data: data || {} });
}

export async function getAiPromptHistorySecure(): Promise<PromptHistoryResponse> {
  return await callSecure(getAiPromptHistorySecureCallable, {});
}

export async function saveAiPromptHistorySecure(toolId: string, entry: UnknownRecord): Promise<PromptHistoryResponse> {
  return await callSecure(saveAiPromptHistorySecureCallable, { toolId, entry });
}

export async function deleteAccountSecure(): Promise<SecureResponse> {
  return await callSecure(deleteAccountSecureCallable, {});
}
