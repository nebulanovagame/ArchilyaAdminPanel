"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openTunnel = openTunnel;
const localtunnel_1 = __importDefault(require("localtunnel"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const tree_kill_1 = __importDefault(require("tree-kill"));
function isTruthyFlag(value) {
    if (!value) {
        return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}
function killProcessTree(pid) {
    return new Promise((resolve) => {
        (0, tree_kill_1.default)(pid, 'SIGTERM', () => {
            resolve();
        });
    });
}
function extractUrlFromOutput(output) {
    const lines = output.split(/\r?\n/);
    for (const line of lines) {
        if (!line.includes('tunneled with tls termination')) {
            continue;
        }
        const lineMatch = line.match(/https:\/\/[^\s,]+/);
        if (lineMatch?.[0]) {
            return lineMatch[0];
        }
    }
    const preferredMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]*lhr\.life/g);
    if (preferredMatch && preferredMatch.length > 0) {
        return preferredMatch[preferredMatch.length - 1];
    }
    return null;
}
function extractCloudflaredUrl(output) {
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
    if (!match || match.length === 0) {
        return null;
    }
    return match[match.length - 1];
}
function resolveCloudflaredExecutable() {
    const envPath = process.env.ARCHILYA_CLOUDFLARED_PATH;
    if (envPath && fs_1.default.existsSync(envPath)) {
        return envPath;
    }
    const candidates = [];
    if (process.resourcesPath) {
        candidates.push(path_1.default.join(process.resourcesPath, 'TunnelTools', 'cloudflared.exe'));
        candidates.push(path_1.default.join(process.resourcesPath, 'app.asar.unpacked', 'TunnelTools', 'cloudflared.exe'));
    }
    candidates.push(path_1.default.join(path_1.default.dirname(process.execPath), 'resources', 'TunnelTools', 'cloudflared.exe'));
    candidates.push(path_1.default.join(path_1.default.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'TunnelTools', 'cloudflared.exe'));
    candidates.push(path_1.default.join(path_1.default.dirname(process.execPath), 'TunnelTools', 'cloudflared.exe'));
    candidates.push(path_1.default.join(process.cwd(), 'TunnelTools', 'cloudflared.exe'));
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return 'cloudflared';
}
async function openCloudflaredTunnel(port) {
    return new Promise((resolve, reject) => {
        const executable = resolveCloudflaredExecutable();
        const args = [
            'tunnel',
            '--url',
            `http://127.0.0.1:${port}`,
            '--protocol',
            'http2',
            '--no-autoupdate',
            '--metrics',
            '127.0.0.1:0',
        ];
        const process = (0, child_process_1.spawn)(executable, args, {
            detached: true,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let settled = false;
        let outputBuffer = '';
        const timeout = setTimeout(async () => {
            if (settled) {
                return;
            }
            settled = true;
            if (process.pid) {
                await killProcessTree(process.pid);
            }
            reject(new Error('cloudflared tüneli zaman aşımına uğradı.'));
        }, 30000);
        const onOutput = async (data) => {
            if (settled) {
                return;
            }
            outputBuffer += data.toString('utf8');
            if (outputBuffer.length > 100000) {
                outputBuffer = outputBuffer.slice(-50000);
            }
            const url = extractCloudflaredUrl(outputBuffer);
            if (!url) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve({
                url,
                provider: 'cloudflared',
                close: async () => {
                    if (process.pid) {
                        await killProcessTree(process.pid);
                    }
                },
            });
        };
        process.stdout?.on('data', onOutput);
        process.stderr?.on('data', onOutput);
        process.once('error', (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });
        process.once('exit', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            reject(new Error(`cloudflared tüneli erken kapandı (exit code: ${code ?? 'unknown'}).`));
        });
    });
}
async function openLocalhostRunTunnel(port) {
    return new Promise((resolve, reject) => {
        const args = [
            '-T',
            '-o',
            'StrictHostKeyChecking=no',
            '-o',
            'UserKnownHostsFile=/dev/null',
            '-R',
            `80:127.0.0.1:${port}`,
            'nokey@localhost.run',
        ];
        const process = (0, child_process_1.spawn)('ssh', args, {
            detached: true,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let settled = false;
        let outputBuffer = '';
        const timeout = setTimeout(async () => {
            if (settled) {
                return;
            }
            settled = true;
            if (process.pid) {
                await killProcessTree(process.pid);
            }
            reject(new Error('localhost.run tüneli zaman aşımına uğradı.'));
        }, 30000);
        const onOutput = async (data) => {
            if (settled) {
                return;
            }
            outputBuffer += data.toString('utf8');
            if (outputBuffer.length > 100000) {
                outputBuffer = outputBuffer.slice(-50000);
            }
            const url = extractUrlFromOutput(outputBuffer);
            if (!url) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve({
                url,
                provider: 'localhost-run',
                close: async () => {
                    if (process.pid) {
                        await killProcessTree(process.pid);
                    }
                },
            });
        };
        process.stdout?.on('data', onOutput);
        process.stderr?.on('data', onOutput);
        process.once('error', (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });
        process.once('exit', (code) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            reject(new Error(`localhost.run tüneli erken kapandı (exit code: ${code ?? 'unknown'}).`));
        });
    });
}
async function openLocalTunnelTunnel(config) {
    const tunnel = await (0, localtunnel_1.default)({
        port: config.port,
        host: config.host,
    });
    return {
        url: tunnel.url,
        provider: 'localtunnel',
        close: async () => {
            tunnel.close();
        },
    };
}
async function openTunnel(config) {
    const providerEnv = (process.env.ARCHILYA_TUNNEL_PROVIDER || 'auto').toLowerCase();
    const preferNoPasswordProvider = config.preferNoPasswordProvider ?? true;
    const allowLocalTunnelFallback = config.allowLocalTunnelFallback
        ?? isTruthyFlag(process.env.ARCHILYA_ENABLE_LOCALTUNNEL_FALLBACK);
    const allowLocalhostRunFallback = isTruthyFlag(process.env.ARCHILYA_ENABLE_LOCALHOSTRUN_FALLBACK);
    const providerOrder = [];
    if (providerEnv === 'cloudflared') {
        providerOrder.push('cloudflared');
    }
    else if (providerEnv === 'localhost-run') {
        providerOrder.push('localhost-run');
    }
    else if (providerEnv === 'localtunnel') {
        providerOrder.push('localtunnel');
    }
    else {
        if (!preferNoPasswordProvider) {
            providerOrder.push('localtunnel');
            if (allowLocalhostRunFallback) {
                providerOrder.push('localhost-run');
            }
        }
        else {
            providerOrder.push('cloudflared');
            if (allowLocalTunnelFallback) {
                providerOrder.push('localtunnel');
            }
            if (allowLocalhostRunFallback) {
                providerOrder.push('localhost-run');
            }
        }
    }
    const uniqueOrder = Array.from(new Set(providerOrder));
    console.log(`[tunnel] providerOrder=${uniqueOrder.join(',')}`);
    const errors = [];
    for (const provider of uniqueOrder) {
        try {
            let session;
            if (provider === 'cloudflared') {
                session = await openCloudflaredTunnel(config.port);
            }
            else if (provider === 'localhost-run') {
                session = await openLocalhostRunTunnel(config.port);
            }
            else {
                session = await openLocalTunnelTunnel(config);
            }
            console.log(`[tunnel] provider=${session.provider} url=${session.url}`);
            return session;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[tunnel] provider=${provider} başarısız: ${message}`);
            errors.push(`${provider}: ${message}`);
        }
    }
    throw new Error(`Hiçbir tunnel provider başlatılamadı. ${errors.join(' | ')}`);
}
