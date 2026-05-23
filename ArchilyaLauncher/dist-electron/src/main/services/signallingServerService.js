"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSignallingServer = startSignallingServer;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const electron_log_1 = __importDefault(require("electron-log"));
function resolveSignallingRoot(scriptPath) {
    return path_1.default.resolve(path_1.default.dirname(scriptPath), '..');
}
function resolveNodeExecutable(scriptPath, preferredNodePath) {
    if (preferredNodePath && fs_1.default.existsSync(preferredNodePath)) {
        return preferredNodePath;
    }
    const bundledNode = path_1.default.join(resolveSignallingRoot(scriptPath), 'platform_scripts', 'cmd', 'node', 'node.exe');
    if (fs_1.default.existsSync(bundledNode)) {
        return bundledNode;
    }
    return preferredNodePath || 'node';
}
function startSignallingServer(config) {
    if (!fs_1.default.existsSync(config.scriptPath)) {
        throw new Error(`Signalling server script bulunamadı: ${config.scriptPath}. ` +
            'ARCHILYA_SIGNAL_SCRIPT_PATH env ile doğru index.js yolunu verebilir veya SignallingWebServer klasörünü release/resources içine kopyalayabilirsiniz.');
    }
    const signallingRoot = resolveSignallingRoot(config.scriptPath);
    const httpRoot = path_1.default.join(signallingRoot, 'www');
    const homepage = config.homepage || 'player.html';
    const maxPlayers = config.maxPlayers ?? 0;
    const nodePath = resolveNodeExecutable(config.scriptPath, config.nodeExecutable);
    const args = [
        config.scriptPath,
        '--no_config',
        '--serve',
        '--player_port',
        String(config.playerPort),
        '--streamer_port',
        String(config.streamerPort),
        '--http_root',
        httpRoot,
        '--homepage',
        homepage,
        '--max_players',
        String(maxPlayers),
        '--console_messages',
        'verbose',
        '--log_config',
    ];
    if (config.peerOptions) {
        args.push('--peer_options', JSON.stringify(config.peerOptions));
    }
    electron_log_1.default.info(`[signalling] node=${nodePath} script=${config.scriptPath} args=${args.slice(1).join(' ')}`);
    return (0, child_process_1.spawn)(nodePath, args, {
        cwd: config.cwd || signallingRoot,
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
    });
}
