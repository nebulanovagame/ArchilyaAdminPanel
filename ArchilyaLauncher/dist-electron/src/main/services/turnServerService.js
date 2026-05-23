"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasLocalTurnExecutable = hasLocalTurnExecutable;
exports.startLocalTurnServer = startLocalTurnServer;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const electron_log_1 = __importDefault(require("electron-log"));
function resolveSignallingRoot(scriptPath) {
    return path_1.default.resolve(path_1.default.dirname(scriptPath), '..');
}
function resolveTurnExecutable(scriptPath) {
    return path_1.default.join(resolveSignallingRoot(scriptPath), 'platform_scripts', 'cmd', 'coturn', 'turnserver.exe');
}
function resolvePidFilePath() {
    const envPath = process.env.ARCHILYA_TURN_PIDFILE;
    if (envPath && envPath.trim() && envPath.trim().toUpperCase() !== 'NUL') {
        return envPath.trim();
    }
    return path_1.default.join(os_1.default.tmpdir(), 'archilya-turnserver.pid');
}
function hasLocalTurnExecutable(scriptPath) {
    return fs_1.default.existsSync(resolveTurnExecutable(scriptPath));
}
function startLocalTurnServer(config) {
    const turnExecutable = resolveTurnExecutable(config.signallingScriptPath);
    if (!fs_1.default.existsSync(turnExecutable)) {
        throw new Error(`Local TURN executable bulunamadı: ${turnExecutable}`);
    }
    const realm = config.realm || 'PixelStreaming';
    const pidFilePath = resolvePidFilePath();
    const args = [
        '-p',
        String(config.port),
        '-r',
        realm,
        '--no-cli',
        '--no-tls',
        '--no-dtls',
        '--pidfile',
        pidFilePath,
        '-f',
        '-a',
        '-v',
        '-u',
        `${config.username}:${config.credential}`,
        '-L',
        config.localIp,
    ];
    if (config.publicIp && config.publicIp !== config.localIp) {
        args.push('-X', config.publicIp);
        args.push('-E', config.localIp);
    }
    electron_log_1.default.info(`[turn] executable=${turnExecutable} localIp=${config.localIp} publicIp=${config.publicIp || '-'} port=${config.port} pidfile=${pidFilePath}`);
    return (0, child_process_1.spawn)(turnExecutable, args, {
        cwd: path_1.default.dirname(turnExecutable),
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
    });
}
