"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStandardLaunchProfile = createStandardLaunchProfile;
exports.createVrProjectLaunchProfile = createVrProjectLaunchProfile;
exports.createPixelStreamingLaunchProfile = createPixelStreamingLaunchProfile;
exports.buildLaunchArgs = buildLaunchArgs;
const DEFAULT_PIXEL_STREAMING_IP = '127.0.0.1';
const DEFAULT_PIXEL_STREAMING_PORT = 8888;
function sanitizeArgValue(value) {
    return value.replace(/["\n\r]/g, '').trim();
}
function buildMapArgs(mapName) {
    const sanitizedMap = sanitizeArgValue(mapName);
    if (!sanitizedMap) {
        throw new Error('Map adı geçersiz.');
    }
    return [sanitizedMap, `-MapToOpen=${sanitizedMap}`];
}
function buildAuthArgs(auth) {
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
function createStandardLaunchProfile() {
    return { mode: 'standard' };
}
function createVrProjectLaunchProfile(mapName) {
    return {
        mode: 'vr-project',
        mapName,
    };
}
function createPixelStreamingLaunchProfile(mapName) {
    return {
        mode: 'pixel-streaming',
        mapName,
        pixelStreaming: {
            ip: DEFAULT_PIXEL_STREAMING_IP,
            port: DEFAULT_PIXEL_STREAMING_PORT,
        },
    };
}
function buildLaunchArgs(profile, auth) {
    const args = [];
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
