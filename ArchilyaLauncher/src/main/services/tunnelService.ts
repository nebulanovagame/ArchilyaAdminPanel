import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import kill from 'tree-kill';

export interface TunnelConfig {
  port: number;
  host?: string;
  preferNoPasswordProvider?: boolean;
  allowLocalTunnelFallback?: boolean;
}

export interface TunnelSession {
  url: string;
  close: () => Promise<void>;
  provider: 'cloudflared' | 'localhost-run' | 'localtunnel';
}

type TunnelProvider = TunnelSession['provider'];

function isTruthyFlag(value?: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    kill(pid, 'SIGTERM', () => {
      resolve();
    });
  });
}

function extractUrlFromOutput(output: string): string | null {
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

function extractCloudflaredUrl(output: string): string | null {
  const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g);
  if (!match || match.length === 0) {
    return null;
  }

  return match[match.length - 1];
}

function resolveCloudflaredExecutable(): string {
  const envPath = process.env.ARCHILYA_CLOUDFLARED_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const candidates: string[] = [];

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'TunnelTools', 'cloudflared.exe'));
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'TunnelTools', 'cloudflared.exe'));
  }

  candidates.push(path.join(path.dirname(process.execPath), 'resources', 'TunnelTools', 'cloudflared.exe'));
  candidates.push(path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'TunnelTools', 'cloudflared.exe'));
  candidates.push(path.join(path.dirname(process.execPath), 'TunnelTools', 'cloudflared.exe'));
  candidates.push(path.join(process.cwd(), 'TunnelTools', 'cloudflared.exe'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'cloudflared';
}

async function openCloudflaredTunnel(port: number): Promise<TunnelSession> {
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

    const process: ChildProcess = spawn(executable, args, {
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

    const onOutput = async (data: Buffer) => {
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

async function openLocalhostRunTunnel(port: number): Promise<TunnelSession> {
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

    const process: ChildProcess = spawn('ssh', args, {
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

    const onOutput = async (data: Buffer) => {
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

async function openLocalTunnelTunnel(config: TunnelConfig): Promise<TunnelSession> {
  const tunnel = await localtunnel({
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

export async function openTunnel(config: TunnelConfig): Promise<TunnelSession> {
  const providerEnv = (process.env.ARCHILYA_TUNNEL_PROVIDER || 'auto').toLowerCase();
  const preferNoPasswordProvider = config.preferNoPasswordProvider ?? true;
  const allowLocalTunnelFallback = config.allowLocalTunnelFallback
    ?? isTruthyFlag(process.env.ARCHILYA_ENABLE_LOCALTUNNEL_FALLBACK);
  const allowLocalhostRunFallback = isTruthyFlag(process.env.ARCHILYA_ENABLE_LOCALHOSTRUN_FALLBACK);

  const providerOrder: TunnelProvider[] = [];

  if (providerEnv === 'cloudflared') {
    providerOrder.push('cloudflared');
  } else if (providerEnv === 'localhost-run') {
    providerOrder.push('localhost-run');
  } else if (providerEnv === 'localtunnel') {
    providerOrder.push('localtunnel');
  } else {
    if (!preferNoPasswordProvider) {
      providerOrder.push('localtunnel');
      if (allowLocalhostRunFallback) {
        providerOrder.push('localhost-run');
      }
    } else {
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

  const errors: string[] = [];

  for (const provider of uniqueOrder) {
    try {
      let session: TunnelSession;

      if (provider === 'cloudflared') {
        session = await openCloudflaredTunnel(config.port);
      } else if (provider === 'localhost-run') {
        session = await openLocalhostRunTunnel(config.port);
      } else {
        session = await openLocalTunnelTunnel(config);
      }

      console.log(`[tunnel] provider=${session.provider} url=${session.url}`);
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[tunnel] provider=${provider} başarısız: ${message}`);
      errors.push(`${provider}: ${message}`);
    }
  }

  throw new Error(`Hiçbir tunnel provider başlatılamadı. ${errors.join(' | ')}`);
}
