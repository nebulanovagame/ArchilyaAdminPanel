"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteCommandListener = void 0;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../firebase");
class RemoteCommandListener {
    static VALID_COMMANDS = ['START_STREAM', 'STOP_STREAM'];
    machineId;
    executor;
    unsubscribe = null;
    processingCommandId = null;
    seenCommandIds = new Map();
    history = [];
    maxHistoryItems = 120;
    seenTtlMs = 6 * 60 * 60 * 1000;
    maxSeenItems = 500;
    constructor(machineId, executor) {
        this.machineId = machineId;
        this.executor = executor;
    }
    start() {
        if (this.unsubscribe) {
            return;
        }
        const commandQuery = (0, firestore_1.query)((0, firebase_1.getLauncherCommandsCollection)(), (0, firestore_1.where)('targetMachineId', '==', this.machineId));
        this.unsubscribe = (0, firestore_1.onSnapshot)(commandQuery, (snapshot) => {
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
    stop() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
    getHistory(limit = 50) {
        return this.history.slice(0, Math.max(1, limit));
    }
    pushHistory(command, status, message, resultUrl) {
        const entry = {
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
    parseCommand(docSnap) {
        const data = docSnap.data();
        const command = data.command;
        const status = data.status;
        const targetMachineId = data.targetMachineId;
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
            mapName: data.mapName,
            projectId: data.projectId,
            requestedBy: data.requestedBy,
            expiresAt: data.expiresAt?.toDate?.(),
            createdAt: data.createdAt?.toDate?.(),
        };
    }
    async handleCommand(command, docSnap) {
        if (command.expiresAt && command.expiresAt.getTime() < Date.now()) {
            const message = 'Komut süresi dolduğu için işlenmedi.';
            await (0, firestore_1.updateDoc)(docSnap.ref, {
                status: 'ignored',
                errorMessage: message,
                processedAt: (0, firestore_1.serverTimestamp)(),
            });
            this.pushHistory(command, 'ignored', message);
            return;
        }
        if (command.command !== 'START_STREAM' && command.command !== 'STOP_STREAM') {
            const message = `Desteklenmeyen komut alındı: ${command.command}`;
            await (0, firestore_1.updateDoc)(docSnap.ref, {
                status: 'ignored',
                errorMessage: message,
                processedAt: (0, firestore_1.serverTimestamp)(),
            });
            this.pushHistory(command, 'ignored', message);
            return;
        }
        if (this.processingCommandId && this.processingCommandId !== command.id) {
            const message = 'Başka bir komut zaten işleniyor.';
            await (0, firestore_1.updateDoc)(docSnap.ref, {
                status: 'ignored',
                errorMessage: message,
                processedAt: (0, firestore_1.serverTimestamp)(),
            });
            this.pushHistory(command, 'ignored', message);
            return;
        }
        this.processingCommandId = command.id;
        this.pushHistory(command, 'processing', 'Komut işlenmeye başlandı.');
        await (0, firestore_1.updateDoc)(docSnap.ref, {
            status: 'processing',
            processingStartedAt: (0, firestore_1.serverTimestamp)(),
            processedByMachineId: this.machineId,
        });
        try {
            if (command.command === 'START_STREAM') {
                const status = await this.executor.getStreamStatus();
                if (status.state === 'running' || status.state === 'starting') {
                    const message = 'Aktif bir yayın zaten çalışıyor.';
                    await (0, firestore_1.updateDoc)(docSnap.ref, {
                        status: 'ignored',
                        errorMessage: message,
                        resultUrl: status.publicUrl || null,
                        processedAt: (0, firestore_1.serverTimestamp)(),
                    });
                    this.pushHistory(command, 'ignored', message, status.publicUrl || undefined);
                    return;
                }
                const result = await this.executor.startStream({ mapName: command.mapName });
                if (!result.success) {
                    const message = result.message || 'Yayın başlatılamadı.';
                    await (0, firestore_1.updateDoc)(docSnap.ref, {
                        status: 'failed',
                        errorMessage: message,
                        processedAt: (0, firestore_1.serverTimestamp)(),
                    });
                    this.pushHistory(command, 'failed', message);
                    return;
                }
                const message = 'Yayın başarıyla başlatıldı.';
                await (0, firestore_1.updateDoc)(docSnap.ref, {
                    status: 'completed',
                    resultUrl: result.publicUrl || null,
                    errorMessage: null,
                    processedAt: (0, firestore_1.serverTimestamp)(),
                });
                this.pushHistory(command, 'completed', message, result.publicUrl || undefined);
                return;
            }
            const status = await this.executor.getStreamStatus();
            if (status.state === 'idle') {
                const message = 'Durdurulacak aktif yayın bulunamadı.';
                await (0, firestore_1.updateDoc)(docSnap.ref, {
                    status: 'ignored',
                    errorMessage: message,
                    processedAt: (0, firestore_1.serverTimestamp)(),
                });
                this.pushHistory(command, 'ignored', message);
                return;
            }
            const stopResult = await this.executor.stopStream();
            if (!stopResult.success) {
                const message = stopResult.message || 'Yayın durdurulamadı.';
                await (0, firestore_1.updateDoc)(docSnap.ref, {
                    status: 'failed',
                    errorMessage: message,
                    processedAt: (0, firestore_1.serverTimestamp)(),
                });
                this.pushHistory(command, 'failed', message);
                return;
            }
            const message = 'Yayın başarıyla durduruldu.';
            await (0, firestore_1.updateDoc)(docSnap.ref, {
                status: 'completed',
                errorMessage: null,
                processedAt: (0, firestore_1.serverTimestamp)(),
            });
            this.pushHistory(command, 'completed', message);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Bilinmeyen işlem hatası.';
            await (0, firestore_1.updateDoc)(docSnap.ref, {
                status: 'failed',
                errorMessage: message,
                processedAt: (0, firestore_1.serverTimestamp)(),
            });
            this.pushHistory(command, 'failed', message);
        }
        finally {
            this.processingCommandId = null;
        }
    }
    cleanupSeenCommandIds() {
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
exports.RemoteCommandListener = RemoteCommandListener;
