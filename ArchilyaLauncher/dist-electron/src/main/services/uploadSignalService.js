"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertProjectUploadSignal = upsertProjectUploadSignal;
exports.clearProjectUploadSignal = clearProjectUploadSignal;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../firebase");
async function readSignals(projectId) {
    const snapshot = await (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId));
    if (!snapshot.exists())
        return [];
    const data = snapshot.data() || {};
    return Array.isArray(data.uploadSignals) ? data.uploadSignals : [];
}
function sanitizeSignalError(errorMessage) {
    return String(errorMessage || '')
        .replace(/https?:\/\/\S+/gi, '[url]')
        .replace(/\br2:\/\/\S+/gi, '[r2]')
        .replace(/[A-Za-z]:\\[^\s"'`]+/g, '[path]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
}
function actorLabel() {
    return firebase_1.auth.currentUser?.displayName || firebase_1.auth.currentUser?.email || firebase_1.auth.currentUser?.uid || 'Launcher';
}
async function upsertProjectUploadSignal(signal) {
    const currentSignals = await readSignals(signal.projectId);
    const nextSignal = {
        ...signal,
        updatedAt: new Date().toISOString(),
        lastError: sanitizeSignalError(signal.lastError),
    };
    const nextSignals = currentSignals.some((item) => String(item?.id || '') === signal.id)
        ? currentSignals.map((item) => (String(item?.id || '') === signal.id ? { ...item, ...nextSignal } : item))
        : [...currentSignals, nextSignal];
    await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', signal.projectId), {
        uploadSignals: nextSignals,
        activityLog: (0, firestore_1.arrayUnion)({
            action: 'upload_signal',
            user: actorLabel(),
            timestamp: new Date().toISOString(),
            details: `${signal.name} için ${signal.status} sinyali yazıldı (Launcher)`,
        }),
        updatedAt: (0, firestore_1.serverTimestamp)(),
    });
}
async function clearProjectUploadSignal(projectId, signalId) {
    const currentSignals = await readSignals(projectId);
    const nextSignals = currentSignals.filter((item) => String(item?.id || '') !== signalId);
    await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
        uploadSignals: nextSignals,
        activityLog: (0, firestore_1.arrayUnion)({
            action: 'upload_signal_clear',
            user: actorLabel(),
            timestamp: new Date().toISOString(),
            details: `${signalId} sinyali temizlendi (Launcher)`,
        }),
        updatedAt: (0, firestore_1.serverTimestamp)(),
    });
}
