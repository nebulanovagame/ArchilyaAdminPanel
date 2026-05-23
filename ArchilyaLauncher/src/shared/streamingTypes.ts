export type StreamingState = 'idle' | 'starting' | 'running' | 'stopping' | 'error';
export type WebShareTunnelProvider = 'cloudflared' | 'localhost-run' | 'localtunnel';
export type WebShareTurnMode = 'managed' | 'local' | 'shared-relay' | 'none';
export type WebShareConnectivityLevel = 'checking' | 'ready' | 'warning' | 'blocked';

export interface WebShareStartRequest {
  mapName?: string;
  playerPort?: number;
  streamerPort?: number;
}

export interface WebShareStartResult {
  success: boolean;
  message?: string;
  publicUrl?: string;
  provider?: WebShareTunnelProvider;
  sessionId?: string;
}

export interface WebShareStatus {
  state: StreamingState;
  publicUrl: string | null;
  playerPort: number;
  streamerPort: number;
  message?: string;
  provider?: WebShareTunnelProvider;
  turnMode?: WebShareTurnMode;
  lastError?: string;
  lastSuccessfulUrl?: string;
  lastStartedAtIso?: string;
  lastStoppedAtIso?: string;
  connectivityLevel?: WebShareConnectivityLevel;
  connectivityMessage?: string;
  internetReachable?: boolean;
  sessionId?: string;
}
