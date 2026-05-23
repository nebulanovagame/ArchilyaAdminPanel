import fs from 'fs';
import net from 'net';
import { randomUUID } from 'crypto';
import type { LaunchAuthContext } from '../../shared/launchProfiles';
import type {
  WebShareConnectivityLevel,
  WebShareStartRequest,
  WebShareStartResult,
  WebShareStatus,
  WebShareTunnelProvider,
  WebShareTurnMode,
} from '../../shared/streamingTypes';
import {
  buildLaunchArgs,
  createPixelStreamingLaunchProfile,
} from './launchProfileService';
import { startArchilyaProcess } from './archilyaProcessService';
import { ProcessRegistry } from './processRegistry';
import { startSignallingServer, type SignallingServerConfig } from './signallingServerService';
import { openTunnel, type TunnelSession } from './tunnelService';
import { createStreamingNetworkConfig } from './networkDiscoveryService';
import { hasLocalTurnExecutable, startLocalTurnServer } from './turnServerService';
import { isGameRunning, setGameProcess } from './gameService';

const SIGNALLING_PROCESS_KEY = 'streaming:signalling';
const ARCHILYA_PROCESS_KEY = 'streaming:archilya';
const TURN_PROCESS_KEY = 'streaming:turn';

function isLocalTurnRequested(): boolean {
  const value = (process.env.ARCHILYA_ENABLE_LOCAL_TURN || '1').toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'no';
}

async function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);

      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });

    if (connected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Port hazır değil: ${host}:${port}`);
}

export interface StreamingOrchestratorConfig {
  signalling: SignallingServerConfig;
  archilyaExecutablePath: string;
}

export class StreamingOrchestrator {
  private readonly processRegistry = new ProcessRegistry();
  private readonly config: StreamingOrchestratorConfig;
  private state: WebShareStatus['state'] = 'idle';
  private publicUrl: string | null = null;
  private lastMessage = '';
  private tunnelSession: TunnelSession | null = null;
  private activePlayerPort: number;
  private activeStreamerPort: number;
  private activeProvider: WebShareTunnelProvider | undefined;
  private activeTurnMode: WebShareTurnMode = 'none';
  private lastError: string | undefined;
  private lastSuccessfulUrl: string | undefined;
  private lastStartedAtIso: string | undefined;
  private lastStoppedAtIso: string | undefined;
  private connectivityLevel: WebShareConnectivityLevel = 'checking';
  private connectivityMessage: string | undefined;
  private internetReachable = false;
  private activeSessionId: string | undefined;

  constructor(config: StreamingOrchestratorConfig) {
    this.config = config;
    this.activePlayerPort = config.signalling.playerPort;
    this.activeStreamerPort = config.signalling.streamerPort;
  }

  getStatus(): WebShareStatus {
    return {
      state: this.state,
      publicUrl: this.publicUrl,
      playerPort: this.activePlayerPort,
      streamerPort: this.activeStreamerPort,
      message: this.lastMessage || undefined,
      provider: this.activeProvider,
      turnMode: this.activeTurnMode,
      lastError: this.lastError,
      lastSuccessfulUrl: this.lastSuccessfulUrl,
      lastStartedAtIso: this.lastStartedAtIso,
      lastStoppedAtIso: this.lastStoppedAtIso,
      connectivityLevel: this.connectivityLevel,
      connectivityMessage: this.connectivityMessage,
      internetReachable: this.internetReachable,
      sessionId: this.activeSessionId,
    };
  }

  private toSessionToken(mapName?: string): string {
    if (!mapName) {
      return 'stream';
    }

    const leafName = mapName.split(/[\\/]/).pop() || mapName;
    const alphanumeric = leafName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!alphanumeric) {
      return 'stream';
    }

    return alphanumeric.slice(0, 24);
  }

  private createStreamSessionId(mapName?: string): string {
    const mapToken = this.toSessionToken(mapName);
    const randomToken = randomUUID().replace(/-/g, '').slice(0, 10);
    return `arch-${mapToken}-${randomToken}`;
  }

  private buildShareUrl(baseUrl: string, sessionId: string): string {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('StreamerId', sessionId);
      url.searchParams.set('AutoConnect', 'true');
      url.searchParams.set('AutoPlayVideo', 'true');
      return url.toString();
    } catch {
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}StreamerId=${encodeURIComponent(sessionId)}&AutoConnect=true&AutoPlayVideo=true`;
    }
  }

  private hasActiveInfrastructure(): boolean {
    return this.processRegistry.isAlive(SIGNALLING_PROCESS_KEY)
      || this.processRegistry.isAlive(ARCHILYA_PROCESS_KEY)
      || this.processRegistry.isAlive(TURN_PROCESS_KEY)
      || this.tunnelSession !== null;
  }

  private async ensureCleanInfrastructure(reason: string): Promise<void> {
    if (!this.hasActiveInfrastructure() && this.state === 'idle') {
      return;
    }

    console.warn(`[streaming] stale cleanup: ${reason}`);
    await this.stop(`Önceki paylaşım oturumu temizlendi (${reason}).`);
  }

  async start(request: WebShareStartRequest, authContext: LaunchAuthContext): Promise<WebShareStartResult> {
    if (this.state === 'starting' || this.state === 'running') {
      return {
        success: false,
        message: 'Web ile paylaşım zaten aktif.',
        publicUrl: this.publicUrl || undefined,
        provider: this.activeProvider,
        sessionId: this.activeSessionId,
      };
    }

    await this.ensureCleanInfrastructure('yeni başlatma öncesi');

    if (isGameRunning()) {
      return {
        success: false,
        message: 'Archilya zaten çalışıyor. Web ile paylaşım için önce mevcut oturumu kapatın.',
      };
    }

    this.state = 'starting';
    this.lastMessage = 'Paylaşım altyapısı başlatılıyor...';
    this.lastError = undefined;
    this.connectivityLevel = 'checking';
    this.connectivityMessage = 'Internet baglantisi ve TURN altyapisi kontrol ediliyor...';
    this.internetReachable = false;
    const streamSessionId = this.createStreamSessionId(request.mapName);
    this.activeSessionId = streamSessionId;

    try {
      const signallingConfig: SignallingServerConfig = {
        ...this.config.signalling,
        playerPort: request.playerPort || this.config.signalling.playerPort,
        streamerPort: request.streamerPort || this.config.signalling.streamerPort,
        homepage: process.env.ARCHILYA_SIGNAL_HOMEPAGE || 'player.html',
        maxPlayers: Number(process.env.ARCHILYA_STREAM_MAX_PLAYERS || 0),
      };
      console.log(`[streaming:start] signallingScript=${signallingConfig.scriptPath} playerPort=${signallingConfig.playerPort} streamerPort=${signallingConfig.streamerPort}`);
      this.activePlayerPort = signallingConfig.playerPort;
      this.activeStreamerPort = signallingConfig.streamerPort;

      this.lastMessage = 'ICE ağı hazırlanıyor...';

      const localTurnRequested = isLocalTurnRequested();
      const localTurnAvailable = hasLocalTurnExecutable(signallingConfig.scriptPath);

      let networkConfig = await createStreamingNetworkConfig({
        localTurn: {
          enabled: localTurnRequested && localTurnAvailable,
          port: Number(process.env.ARCHILYA_TURN_PORT || 3478),
          username: process.env.ARCHILYA_TURN_USERNAME || 'PixelStreamingUser',
          credential: process.env.ARCHILYA_TURN_CREDENTIAL || 'AnotherTURNintheroad',
        },
      });

      if (localTurnRequested && !networkConfig.turn.enabled) {
        console.warn('[streaming:start] Local TURN devre dışı bırakıldı (public IP uygun değil). Public relay TURN kullanılacak.');
      }

      this.activeTurnMode =
        networkConfig.turnSource === 'managed'
          ? 'managed'
          : networkConfig.turnSource === 'local'
            ? 'local'
            : networkConfig.turnSource === 'shared-fallback'
              ? 'shared-relay'
              : 'none';
      this.connectivityMessage = networkConfig.connectivityMessage;
      this.internetReachable = networkConfig.internetReachable;

      if (!networkConfig.internetReachable) {
        this.connectivityLevel = 'blocked';
        throw new Error(networkConfig.connectivityMessage || 'Internet paylasimi icin TURN altyapisi hazir degil.');
      }

      this.connectivityLevel = networkConfig.turnSource === 'shared-fallback' ? 'warning' : 'ready';

      if (networkConfig.turn.enabled && localTurnAvailable) {
        try {
          this.lastMessage = 'TURN servisi başlatılıyor...';
          const turnProcess = startLocalTurnServer({
            signallingScriptPath: signallingConfig.scriptPath,
            localIp: networkConfig.localIp,
            publicIp: networkConfig.publicIp,
            port: networkConfig.turn.port,
            username: networkConfig.turn.username,
            credential: networkConfig.turn.credential,
          });
          this.processRegistry.register(TURN_PROCESS_KEY, turnProcess);
        } catch (turnError) {
          console.warn('[streaming:start] Yerel TURN başlatılamadı, public relay ile devam edilecek.', turnError);
          networkConfig = await createStreamingNetworkConfig({
            localTurn: {
              enabled: false,
              port: 3478,
              username: networkConfig.turn.username,
              credential: networkConfig.turn.credential,
            },
          });
        }
      }

      signallingConfig.peerOptions = networkConfig.peerOptions;

      if (!fs.existsSync(this.config.archilyaExecutablePath)) {
        throw new Error('Archilya dosyası bulunamadı.');
      }

      this.lastMessage = 'Yayın sunucusu başlatılıyor...';
      const signallingProcess = startSignallingServer(signallingConfig);
      this.processRegistry.register(SIGNALLING_PROCESS_KEY, signallingProcess);

      await waitForPort('127.0.0.1', signallingConfig.playerPort, 15000);

      const profile = createPixelStreamingLaunchProfile(request.mapName);
      profile.pixelStreaming = {
        ip: '127.0.0.1',
        port: signallingConfig.streamerPort,
        streamerId: streamSessionId,
      };

      const launchArgs = buildLaunchArgs(profile, authContext);
      console.log(`[streaming:start] map=${request.mapName || '-'} args=${launchArgs.join(' ')}`);
      this.lastMessage = 'Archilya bağlanıyor...';
      const archilyaProcess = startArchilyaProcess(this.config.archilyaExecutablePath, launchArgs, { windowsHide: true });
      this.processRegistry.register(ARCHILYA_PROCESS_KEY, archilyaProcess);
      setGameProcess(archilyaProcess);
      archilyaProcess.unref();

      this.lastMessage = 'Tünel bağlantısı hazırlanıyor...';
      const tunnel = await openTunnel({ port: signallingConfig.playerPort });
      const shareUrl = this.buildShareUrl(tunnel.url, streamSessionId);
      this.tunnelSession = tunnel;
      this.publicUrl = shareUrl;
      this.activeProvider = tunnel.provider;
      this.lastSuccessfulUrl = shareUrl;
      this.lastStartedAtIso = new Date().toISOString();
      this.lastStoppedAtIso = undefined;
      this.state = 'running';
      this.lastMessage = `Web ile paylaşım aktif (${tunnel.provider}, ${this.describeTurnMode(this.activeTurnMode)}).`;

      return {
        success: true,
        publicUrl: this.publicUrl,
        provider: this.activeProvider,
        message: this.connectivityMessage || this.lastMessage,
        sessionId: this.activeSessionId,
      };
    } catch (error: unknown) {
      await this.stop('Web ile paylaşım başlatılamadı, süreçler kapatıldı.');
      this.state = 'error';
      this.lastMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.lastError = this.lastMessage;
      if (this.connectivityLevel === 'checking') {
        this.connectivityLevel = 'blocked';
      }
      this.connectivityMessage = this.connectivityMessage || this.lastMessage;
      return {
        success: false,
        message: this.lastMessage,
      };
    }
  }

  private describeTurnMode(turnMode: WebShareTurnMode): string {
    if (turnMode === 'managed') {
      return 'managed TURN';
    }

    if (turnMode === 'local') {
      return 'local TURN';
    }

    if (turnMode === 'shared-relay') {
      return 'shared relay TURN';
    }

    return 'TURN yok';
  }

  async stop(message = 'Web ile paylaşım durduruldu.'): Promise<{ success: boolean; message?: string }> {
    if (this.state === 'idle') {
      return { success: true, message: 'Paylaşım zaten kapalı.' };
    }

    this.state = 'stopping';

    if (this.tunnelSession) {
      try {
        await this.tunnelSession.close();
      } finally {
        this.tunnelSession = null;
      }
    }

    await this.processRegistry.killAllSettled();
    setGameProcess(null);

    this.publicUrl = null;
    this.activeProvider = undefined;
    this.activeTurnMode = 'none';
    this.connectivityLevel = 'checking';
    this.connectivityMessage = undefined;
    this.internetReachable = false;
    this.activeSessionId = undefined;
    this.activePlayerPort = this.config.signalling.playerPort;
    this.activeStreamerPort = this.config.signalling.streamerPort;
    this.state = 'idle';
    this.lastMessage = message;
    this.lastStoppedAtIso = new Date().toISOString();

    return { success: true, message };
  }

  async shutdown(): Promise<void> {
    await this.stop('Uygulama kapanırken paylaşım süreçleri sonlandırıldı.');
  }
}
