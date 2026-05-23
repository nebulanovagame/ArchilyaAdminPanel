import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import type { PeerConnectionOptions } from '../../shared/streamingConfigTypes';
import log from 'electron-log';

export interface SignallingServerConfig {
  scriptPath: string;
  playerPort: number;
  streamerPort: number;
  maxPlayers?: number;
  homepage?: string;
  nodeExecutable?: string;
  cwd?: string;
  peerOptions?: PeerConnectionOptions;
}

function resolveSignallingRoot(scriptPath: string): string {
  return path.resolve(path.dirname(scriptPath), '..');
}

function resolveNodeExecutable(scriptPath: string, preferredNodePath?: string): string {
  if (preferredNodePath && fs.existsSync(preferredNodePath)) {
    return preferredNodePath;
  }

  const bundledNode = path.join(
    resolveSignallingRoot(scriptPath),
    'platform_scripts',
    'cmd',
    'node',
    'node.exe',
  );

  if (fs.existsSync(bundledNode)) {
    return bundledNode;
  }

  return preferredNodePath || 'node';
}

export function startSignallingServer(config: SignallingServerConfig): ChildProcess {
  if (!fs.existsSync(config.scriptPath)) {
    throw new Error(
      `Signalling server script bulunamadı: ${config.scriptPath}. ` +
      'ARCHILYA_SIGNAL_SCRIPT_PATH env ile doğru index.js yolunu verebilir veya SignallingWebServer klasörünü release/resources içine kopyalayabilirsiniz.',
    );
  }

  const signallingRoot = resolveSignallingRoot(config.scriptPath);
  const httpRoot = path.join(signallingRoot, 'www');
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

  log.info(`[signalling] node=${nodePath} script=${config.scriptPath} args=${args.slice(1).join(' ')}`);

  return spawn(nodePath, args, {
    cwd: config.cwd || signallingRoot,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
}
