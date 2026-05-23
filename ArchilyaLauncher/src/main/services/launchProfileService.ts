import type { LaunchAuthContext, LaunchProfile } from '../../shared/launchProfiles';

const DEFAULT_PIXEL_STREAMING_IP = '127.0.0.1';
const DEFAULT_PIXEL_STREAMING_PORT = 8888;

function sanitizeArgValue(value: string): string {
  return value.replace(/["\n\r]/g, '').trim();
}

function buildMapArgs(mapName: string): string[] {
  const sanitizedMap = sanitizeArgValue(mapName);
  if (!sanitizedMap) {
    throw new Error('Map adı geçersiz.');
  }

  return [sanitizedMap, `-MapToOpen=${sanitizedMap}`];
}

function buildAuthArgs(auth?: LaunchAuthContext): string[] {
  if (!auth) {
    return [];
  }

  const args = [`-UID=${sanitizeArgValue(auth.uid)}`];

  if (auth.token) {
    args.push(`-Token=${sanitizeArgValue(auth.token)}`);
  }

  if (auth.displayName) {
    args.push(`-DisplayName=${sanitizeArgValue(auth.displayName)}`);
  }

  args.push(`-IsGuest=${auth.isGuest ? '1' : '0'}`);
  args.push(`-Verified=${auth.isVerified ? '1' : '0'}`);

  return args;
}

export function createStandardLaunchProfile(): LaunchProfile {
  return { mode: 'standard' };
}

export function createVrProjectLaunchProfile(mapName: string): LaunchProfile {
  return {
    mode: 'vr-project',
    mapName,
  };
}

export function createPixelStreamingLaunchProfile(mapName?: string): LaunchProfile {
  return {
    mode: 'pixel-streaming',
    mapName,
    pixelStreaming: {
      ip: DEFAULT_PIXEL_STREAMING_IP,
      port: DEFAULT_PIXEL_STREAMING_PORT,
    },
  };
}

export function buildLaunchArgs(profile: LaunchProfile, auth?: LaunchAuthContext): string[] {
  const args: string[] = [];
  const map = profile.mapName?.trim();

  if (profile.mode === 'vr-project') {
    if (!map) {
      throw new Error('VR ile başlatma için map bilgisi zorunludur.');
    }

    args.push(...buildMapArgs(map));
    args.push('-vr');
    args.push('-d3d11');
  }

  if (profile.mode === 'pixel-streaming') {
    const streamingIp = profile.pixelStreaming?.ip || DEFAULT_PIXEL_STREAMING_IP;
    const streamingPort = profile.pixelStreaming?.port || DEFAULT_PIXEL_STREAMING_PORT;
    const streamingId = profile.pixelStreaming?.streamerId
      ? sanitizeArgValue(profile.pixelStreaming.streamerId)
      : '';

    if (map) {
      args.push(...buildMapArgs(map));
    }

    args.push('-AudioMixer');
    args.push(`-PixelStreamingIP=${sanitizeArgValue(streamingIp)}`);
    args.push(`-PixelStreamingPort=${streamingPort}`);
    if (streamingId) {
      args.push(`-PixelStreamingID=${streamingId}`);
    }
  }

  args.push(...buildAuthArgs(auth));

  if (profile.extraArgs && profile.extraArgs.length > 0) {
    args.push(...profile.extraArgs);
  }

  return args;
}
