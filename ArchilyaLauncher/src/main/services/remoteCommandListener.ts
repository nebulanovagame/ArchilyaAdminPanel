import {
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { WebShareStartResult, WebShareStatus } from '../../shared/streamingTypes';
import { getLauncherCommandsCollection } from '../firebase';
import type {
  LauncherRemoteCommand,
  RemoteCommandType,
  RemoteCommandHistoryEntry,
  RemoteCommandStatus,
} from '../../shared/remoteCommandTypes';

interface RemoteCommandExecutor {
  startStream: (request: { mapName?: string }) => Promise<WebShareStartResult>;
  stopStream: () => Promise<{ success: boolean; message?: string }>;
  getStreamStatus: () => Promise<WebShareStatus>;
}

export class RemoteCommandListener {
  private static readonly VALID_COMMANDS: readonly RemoteCommandType[] = ['START_STREAM', 'STOP_STREAM'];

  private readonly machineId: string;
  private readonly executor: RemoteCommandExecutor;
  private unsubscribe: Unsubscribe | null = null;
  private processingCommandId: string | null = null;
  private readonly seenCommandIds = new Map<string, number>();
  private readonly history: RemoteCommandHistoryEntry[] = [];
  private readonly maxHistoryItems = 120;
  private readonly seenTtlMs = 6 * 60 * 60 * 1000;
  private readonly maxSeenItems = 500;

  constructor(machineId: string, executor: RemoteCommandExecutor) {
    this.machineId = machineId;
    this.executor = executor;
  }

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    const commandQuery = query(
      getLauncherCommandsCollection(),
      where('targetMachineId', '==', this.machineId),
    );

    this.unsubscribe = onSnapshot(commandQuery, (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added' && change.type !== 'modified') {
          continue;
        }

        const command = this.parseCommand(change.doc);
        if (!command || command.status !== 'pending') {
          continue;
        }

        this.cleanupSeenCommandIds();
        if (this.seenCommandIds.has(command.id)) {
          continue;
        }

        this.seenCommandIds.set(command.id, Date.now());
        void this.handleCommand(command, change.doc);
      }
    });
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  getHistory(limit = 50): RemoteCommandHistoryEntry[] {
    return this.history.slice(0, Math.max(1, limit));
  }

  private pushHistory(
    command: LauncherRemoteCommand,
    status: RemoteCommandStatus,
    message: string,
    resultUrl?: string,
  ): void {
    const entry: RemoteCommandHistoryEntry = {
      commandId: command.id,
      command: command.command,
      status,
      message,
      resultUrl,
      mapName: command.mapName,
      requestedBy: command.requestedBy,
      timestampIso: new Date().toISOString(),
    };

    this.history.unshift(entry);
    if (this.history.length > this.maxHistoryItems) {
      this.history.length = this.maxHistoryItems;
    }
  }

  private parseCommand(docSnap: QueryDocumentSnapshot<DocumentData>): LauncherRemoteCommand | null {
    const data = docSnap.data();
    const command = data.command as RemoteCommandType | undefined;
    const status = data.status as LauncherRemoteCommand['status'] | undefined;
    const targetMachineId = data.targetMachineId as string | undefined;

    if (!command || !status || !targetMachineId) {
      return null;
    }

    if (!RemoteCommandListener.VALID_COMMANDS.includes(command)) {
      return null;
    }

    return {
      id: docSnap.id,
      targetMachineId,
      command,
      status,
      mapName: data.mapName as string | undefined,
      projectId: data.projectId as string | undefined,
      requestedBy: data.requestedBy as string | undefined,
      expiresAt: data.expiresAt?.toDate?.(),
      createdAt: data.createdAt?.toDate?.(),
    };
  }

  private async handleCommand(
    command: LauncherRemoteCommand,
    docSnap: QueryDocumentSnapshot<DocumentData>,
  ): Promise<void> {
    if (command.expiresAt && command.expiresAt.getTime() < Date.now()) {
      const message = 'Komut süresi dolduğu için işlenmedi.';
      await updateDoc(docSnap.ref, {
        status: 'ignored',
        errorMessage: message,
        processedAt: serverTimestamp(),
      });
      this.pushHistory(command, 'ignored', message);
      return;
    }

    if (command.command !== 'START_STREAM' && command.command !== 'STOP_STREAM') {
      const message = `Desteklenmeyen komut alındı: ${command.command}`;
      await updateDoc(docSnap.ref, {
        status: 'ignored',
        errorMessage: message,
        processedAt: serverTimestamp(),
      });
      this.pushHistory(command, 'ignored', message);
      return;
    }

    if (this.processingCommandId && this.processingCommandId !== command.id) {
      const message = 'Başka bir komut zaten işleniyor.';
      await updateDoc(docSnap.ref, {
        status: 'ignored',
        errorMessage: message,
        processedAt: serverTimestamp(),
      });
      this.pushHistory(command, 'ignored', message);
      return;
    }

    this.processingCommandId = command.id;
    this.pushHistory(command, 'processing', 'Komut işlenmeye başlandı.');

    await updateDoc(docSnap.ref, {
      status: 'processing',
      processingStartedAt: serverTimestamp(),
      processedByMachineId: this.machineId,
    });

    try {
      if (command.command === 'START_STREAM') {
        const status = await this.executor.getStreamStatus();
        if (status.state === 'running' || status.state === 'starting') {
          const message = 'Aktif bir yayın zaten çalışıyor.';
          await updateDoc(docSnap.ref, {
            status: 'ignored',
            errorMessage: message,
            resultUrl: status.publicUrl || null,
            processedAt: serverTimestamp(),
          });
          this.pushHistory(command, 'ignored', message, status.publicUrl || undefined);
          return;
        }

        const result = await this.executor.startStream({ mapName: command.mapName });
        if (!result.success) {
          const message = result.message || 'Yayın başlatılamadı.';
          await updateDoc(docSnap.ref, {
            status: 'failed',
            errorMessage: message,
            processedAt: serverTimestamp(),
          });
          this.pushHistory(command, 'failed', message);
          return;
        }

        const message = 'Yayın başarıyla başlatıldı.';
        await updateDoc(docSnap.ref, {
          status: 'completed',
          resultUrl: result.publicUrl || null,
          errorMessage: null,
          processedAt: serverTimestamp(),
        });
        this.pushHistory(command, 'completed', message, result.publicUrl || undefined);
        return;
      }

      const status = await this.executor.getStreamStatus();
      if (status.state === 'idle') {
        const message = 'Durdurulacak aktif yayın bulunamadı.';
        await updateDoc(docSnap.ref, {
          status: 'ignored',
          errorMessage: message,
          processedAt: serverTimestamp(),
        });
        this.pushHistory(command, 'ignored', message);
        return;
      }

      const stopResult = await this.executor.stopStream();
      if (!stopResult.success) {
        const message = stopResult.message || 'Yayın durdurulamadı.';
        await updateDoc(docSnap.ref, {
          status: 'failed',
          errorMessage: message,
          processedAt: serverTimestamp(),
        });
        this.pushHistory(command, 'failed', message);
        return;
      }

      const message = 'Yayın başarıyla durduruldu.';
      await updateDoc(docSnap.ref, {
        status: 'completed',
        errorMessage: null,
        processedAt: serverTimestamp(),
      });
      this.pushHistory(command, 'completed', message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen işlem hatası.';
      await updateDoc(docSnap.ref, {
        status: 'failed',
        errorMessage: message,
        processedAt: serverTimestamp(),
      });
      this.pushHistory(command, 'failed', message);
    } finally {
      this.processingCommandId = null;
    }
  }

  private cleanupSeenCommandIds(): void {
    const now = Date.now();

    for (const [commandId, timestamp] of this.seenCommandIds.entries()) {
      if (now - timestamp > this.seenTtlMs) {
        this.seenCommandIds.delete(commandId);
      }
    }

    if (this.seenCommandIds.size <= this.maxSeenItems) {
      return;
    }

    const overflow = this.seenCommandIds.size - this.maxSeenItems;
    const oldestEntries = Array.from(this.seenCommandIds.entries())
      .sort((left, right) => left[1] - right[1])
      .slice(0, overflow);

    for (const [commandId] of oldestEntries) {
      this.seenCommandIds.delete(commandId);
    }
  }
}
