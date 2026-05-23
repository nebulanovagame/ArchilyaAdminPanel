"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePublicIp = resolvePublicIp;
exports.createStreamingNetworkConfig = createStreamingNetworkConfig;
const os_1 = __importDefault(require("os"));
const https_1 = __importDefault(require("https"));
const DEFAULT_STUN_SERVERS = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
];
const DEFAULT_PUBLIC_TURN = {
    urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
};
function isValidIp(ip) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim());
}
function parseIpv4(ip) {
    if (!isValidIp(ip)) {
        return null;
    }
    const parts = ip.trim().split('.').map((item) => Number(item));
    if (parts.length !== 4 || parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
        return null;
    }
    return [parts[0], parts[1], parts[2], parts[3]];
}
function isRoutablePublicIpv4(ip) {
    const parsed = parseIpv4(ip);
    if (!parsed) {
        return false;
    }
    const [a, b] = parsed;
    if (a === 0 || a === 10 || a === 127) {
        return false;
    }
    // Carrier-grade NAT
    if (a === 100 && b >= 64 && b <= 127) {
        return false;
    }
    if (a === 169 && b === 254) {
        return false;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return false;
    }
    if (a === 192 && b === 168) {
        return false;
    }
    // multicast/reserved
    if (a >= 224) {
        return false;
    }
    return true;
}
function shouldEnableLocalTurn(requested, publicIp) {
    if (!requested) {
        return false;
    }
    const forceLocalTurn = (process.env.ARCHILYA_FORCE_LOCAL_TURN || '').toLowerCase();
    if (forceLocalTurn === '1' || forceLocalTurn === 'true' || forceLocalTurn === 'yes') {
        return true;
    }
    return Boolean(publicIp && isRoutablePublicIpv4(publicIp));
}
function getPreferredLocalIp() {
    const interfaces = os_1.default.networkInterfaces();
    for (const values of Object.values(interfaces)) {
        if (!values) {
            continue;
        }
        for (const iface of values) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}
function readUrl(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const request = https_1.default.get(url, { timeout: timeoutMs }, (response) => {
            if (!response.statusCode || response.statusCode >= 400) {
                reject(new Error(`HTTP ${response.statusCode || 'ERR'}`));
                return;
            }
            let body = '';
            response.on('data', (chunk) => {
                body += chunk.toString();
            });
            response.on('end', () => {
                resolve(body.trim());
            });
        });
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy(new Error('timeout'));
        });
    });
}
async function resolvePublicIp() {
    const sources = [
        'https://api.ipify.org',
        'https://ifconfig.me/ip',
        'https://icanhazip.com',
    ];
    for (const source of sources) {
        try {
            const value = await readUrl(source, 3500);
            if (isValidIp(value)) {
                return value;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
function parseList(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function getEnvTurnServer() {
    const urls = parseList(process.env.ARCHILYA_TURN_URLS);
    const username = process.env.ARCHILYA_TURN_USERNAME;
    const credential = process.env.ARCHILYA_TURN_CREDENTIAL;
    if (urls.length === 0 || !username || !credential) {
        return null;
    }
    return {
        urls,
        username,
        credential,
    };
}
function hasManagedTurnConfig() {
    return getEnvTurnServer() !== null;
}
function isSharedTurnFallbackAllowed() {
    const value = (process.env.ARCHILYA_ALLOW_SHARED_TURN_FALLBACK || '').trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
}
function buildStunServers() {
    const envStun = parseList(process.env.ARCHILYA_STUN_SERVERS);
    const stunUrls = envStun.length > 0 ? envStun : DEFAULT_STUN_SERVERS;
    return stunUrls.map((url) => ({ urls: url }));
}
function buildLocalTurnServer(turn) {
    return {
        urls: [
            `turn:${turn.host}:${turn.port}?transport=udp`,
            `turn:${turn.host}:${turn.port}?transport=tcp`,
        ],
        username: turn.username,
        credential: turn.credential,
    };
}
function buildDefaultPublicTurnServer() {
    return {
        urls: DEFAULT_PUBLIC_TURN.urls,
        username: DEFAULT_PUBLIC_TURN.username,
        credential: DEFAULT_PUBLIC_TURN.credential,
    };
}
async function createStreamingNetworkConfig(input = {}) {
    const localIp = getPreferredLocalIp();
    const publicIp = await resolvePublicIp();
    const localTurnInput = input.localTurn;
    const localTurnEnabled = shouldEnableLocalTurn(Boolean(localTurnInput?.enabled), publicIp);
    const turn = {
        enabled: localTurnEnabled,
        host: localTurnInput?.host || (localTurnEnabled ? (publicIp || localIp) : localIp),
        port: localTurnInput?.port || 3478,
        username: localTurnInput?.username || 'PixelStreamingUser',
        credential: localTurnInput?.credential || 'AnotherTURNintheroad',
    };
    const iceServers = [...buildStunServers()];
    const envTurn = getEnvTurnServer();
    const sharedTurnAllowed = isSharedTurnFallbackAllowed();
    let turnSource = 'none';
    let internetReachable = false;
    let connectivityMessage;
    if (envTurn) {
        iceServers.push(envTurn);
        turnSource = 'managed';
        internetReachable = true;
        connectivityMessage = 'Managed TURN hazir. Musteri link ile dogrudan tarayicidan baglanabilir.';
    }
    else if (turn.enabled) {
        iceServers.push(buildLocalTurnServer(turn));
        turnSource = 'local';
        internetReachable = true;
        connectivityMessage = 'Yerel TURN aktif. Host makinenin public IP uzerinden erisilebilirligi kullaniliyor.';
    }
    else if (sharedTurnAllowed) {
        iceServers.push(buildDefaultPublicTurnServer());
        turnSource = 'shared-fallback';
        internetReachable = true;
        connectivityMessage = 'Paylasim shared TURN fallback ile aciliyor. Gecici kullanim icin uygun, ancak prod icin kendi managed TURN bilginizi ekleyin.';
    }
    else if (!hasManagedTurnConfig()) {
        connectivityMessage = 'Internet paylasimi icin managed TURN ayari eksik. ARCHILYA_TURN_URLS, ARCHILYA_TURN_USERNAME ve ARCHILYA_TURN_CREDENTIAL tanimlanmali.';
    }
    const peerOptions = { iceServers };
    return {
        publicIp,
        localIp,
        peerOptions,
        turn,
        turnSource,
        internetReachable,
        connectivityMessage,
    };
}
