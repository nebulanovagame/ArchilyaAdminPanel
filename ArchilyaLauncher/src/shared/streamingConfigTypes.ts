export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type TurnInfrastructureSource = 'managed' | 'local' | 'shared-fallback' | 'none';

export interface PeerConnectionOptions {
  iceServers: IceServerConfig[];
}

export interface TurnServerRuntimeConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  credential: string;
}

export interface StreamingNetworkConfig {
  publicIp: string | null;
  localIp: string;
  peerOptions: PeerConnectionOptions;
  turn: TurnServerRuntimeConfig;
  turnSource: TurnInfrastructureSource;
  internetReachable: boolean;
  connectivityMessage?: string;
}
