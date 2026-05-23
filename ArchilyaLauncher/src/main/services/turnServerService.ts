import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import log from 'electron-log';

export interface TurnServerConfig {
  signallingScriptPath: string;
  localIp: string;
  publicIp: string | null;
  port: number;
  username: string;
  credential: string;
  realm?: string;
}

function resolveSignallingRoot(scriptPath: string): string {
  return path.resolve(path.dirname(scriptPath), '..');
}

function resolveTurnExecutable(scriptPath: string): string {
  return path.join(
    resolveSignallingRoot(scriptPath),
    'platform_scripts',
    'cmd',
    'coturn',
    'turnserver.exe',
  );
}

function resolvePidFilePath(): string {
  const envPath = process.env.ARCHILYA_TURN_PIDFILE;
  if (envPath && envPath.trim() && envPath.trim().toUpperCase() !== 'NUL') {
    return envPath.trim();
  }

  return path.join(os.tmpdir(), 'archilya-turnserver.pid');
}

export function hasLocalTurnExecutable(scriptPath: string): boolean {
  return fs.existsSync(resolveTurnExecutable(scriptPath));
}

export function startLocalTurnServer(config: TurnServerConfig): ChildProcess {
  const turnExecutable = resolveTurnExecutable(config.signallingScriptPath);
  if (!fs.existsSync(turnExecutable)) {
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

  log.info(
    `[turn] executable=${turnExecutable} localIp=${config.localIp} publicIp=${config.publicIp || '-'} port=${config.port} pidfile=${pidFilePath}`,
  );

  return spawn(turnExecutable, args, {
    cwd: path.dirname(turnExecutable),
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
}
