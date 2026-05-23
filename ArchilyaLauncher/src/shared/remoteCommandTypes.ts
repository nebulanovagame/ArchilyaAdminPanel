export type RemoteCommandType = 'START_STREAM' | 'STOP_STREAM';
export type RemoteCommandStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';

export interface LauncherRemoteCommand {
  id: string;
  targetMachineId: string;
  projectId?: string;
  command: RemoteCommandType;
  status: RemoteCommandStatus;
  mapName?: string;
  requestedBy?: string;
  createdAt?: Date;
  expiresAt?: Date;
  resultUrl?: string;
  errorMessage?: string;
}

export interface RemoteCommandHistoryEntry {
  commandId: string;
  command: RemoteCommandType;
  status: RemoteCommandStatus;
  message: string;
  timestampIso: string;
  resultUrl?: string;
  mapName?: string;
  requestedBy?: string;
}

export interface MachineIdentityInfo {
  machineId: string;
  hostname: string;
  platform: string;
  arch: string;
}
