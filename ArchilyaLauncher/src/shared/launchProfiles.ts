export type LaunchMode = 'standard' | 'vr-project' | 'pixel-streaming';

export interface PixelStreamingOptions {
  ip: string;
  port: number;
  streamerId?: string;
}

export interface LaunchProfile {
  mode: LaunchMode;
  mapName?: string;
  pixelStreaming?: PixelStreamingOptions;
  extraArgs?: string[];
}

export interface LaunchAuthContext {
  uid: string;
  token?: string;
  displayName?: string | null;
  isGuest?: boolean;
  isVerified?: boolean;
}

export interface LaunchRequest {
  mode: LaunchMode;
  mapName?: string;
  pixelStreaming?: PixelStreamingOptions;
}
