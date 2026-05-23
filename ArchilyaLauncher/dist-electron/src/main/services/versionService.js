"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveFileVersion = saveFileVersion;
exports.getFileVersions = getFileVersions;
exports.restoreFileVersion = restoreFileVersion;
exports.updateVersionNote = updateVersionNote;
const firestore_1 = require("firebase/firestore");
const storage_1 = require("firebase/storage");
const firebase_1 = require("../firebase");
const electron_log_1 = __importDefault(require("electron-log"));
// ════════════════════════════════════════════════════════════
// VERSİYON SERVİSİ — Dosya versiyonlama, listeleme, geri yükleme
// ════════════════════════════════════════════════════════════
/** Bir dosya için bir sonraki versiyon numarasını hesapla */
async function getNextVersionNumber(projectId, fileId) {
    try {
        const versionsRef = (0, firestore_1.collection)(firebase_1.db, 'projects', projectId, 'fileVersions');
        const q = (0, firestore_1.query)(versionsRef, (0, firestore_1.where)('fileId', '==', fileId), (0, firestore_1.orderBy)('versionNumber', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        if (snapshot.empty)
            return 1;
        return (snapshot.docs[0].data()?.versionNumber || 0) + 1;
    }
    catch {
        return 1;
    }
}
/**
 * Yeni bir dosya versiyonu kaydet (upload sonrası çağrılır)
 */
async function saveFileVersion(projectId, file) {
    try {
        const versionNumber = await getNextVersionNumber(projectId, file.name);
        const version = {
            id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            fileId: file.name, // dosya adı benzersiz kimlik olarak kullanılır
            name: file.name,
            url: file.url,
            path: file.path,
            size: file.size,
            type: file.type,
            storageProvider: file.storageProvider || 'firebase',
            objectKey: file.objectKey,
            contentType: file.contentType || 'application/octet-stream',
            createdAt: new Date().toISOString(),
            uploadedBy: file.uploadedBy || 'Bilinmeyen',
            versionNumber,
        };
        const versionRef = (0, firestore_1.doc)(firebase_1.db, 'projects', projectId, 'fileVersions', version.id);
        await (0, firestore_1.updateDoc)(versionRef, { ...version });
        // Projeye activityLog ekle
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
            activityLog: (0, firestore_1.arrayUnion)({
                action: 'version_created',
                user: version.uploadedBy,
                timestamp: version.createdAt,
                details: `${file.name} için v${versionNumber} versiyonu oluşturuldu (${formatBytes(file.size)})`,
            }),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        return { success: true, version };
    }
    catch (err) {
        electron_log_1.default.error('[VersionService] saveFileVersion error:', err);
        return { success: false, error: err.message || 'Versiyon kaydedilemedi.' };
    }
}
/**
 * Bir dosyanın tüm versiyonlarını listele
 */
async function getFileVersions(projectId, fileId) {
    try {
        const versionsRef = (0, firestore_1.collection)(firebase_1.db, 'projects', projectId, 'fileVersions');
        const q = (0, firestore_1.query)(versionsRef, (0, firestore_1.where)('fileId', '==', fileId), (0, firestore_1.orderBy)('versionNumber', 'desc'));
        const snapshot = await (0, firestore_1.getDocs)(q);
        const versions = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                fileId: data.fileId,
                name: data.name,
                url: data.url,
                path: data.path,
                size: data.size,
                type: data.type,
                storageProvider: data.storageProvider,
                objectKey: data.objectKey,
                contentType: data.contentType,
                createdAt: data.createdAt,
                uploadedBy: data.uploadedBy,
                changeNote: data.changeNote,
                versionNumber: data.versionNumber,
            };
        });
        return { success: true, versions };
    }
    catch (err) {
        electron_log_1.default.error('[VersionService] getFileVersions error:', err);
        return { success: false, versions: [], error: err.message || 'Versiyonlar listelenemedi.' };
    }
}
/**
 * Bir versiyonu geri yükle (yerel dosyayı indir + Firestore güncelle)
 */
async function restoreFileVersion(projectId, versionId, localDirPath) {
    try {
        // Versiyonu bul
        const versionRef = (0, firestore_1.doc)(firebase_1.db, 'projects', projectId, 'fileVersions', versionId);
        const versionSnap = await (0, firestore_1.getDoc)(versionRef);
        if (!versionSnap.exists()) {
            return { success: false, error: 'Versiyon bulunamadı.' };
        }
        const version = versionSnap.data();
        // Projeyi oku
        const projectRef = (0, firestore_1.doc)(firebase_1.db, 'projects', projectId);
        const projectSnap = await (0, firestore_1.getDoc)(projectRef);
        if (!projectSnap.exists()) {
            return { success: false, error: 'Proje bulunamadı.' };
        }
        const projectData = projectSnap.data();
        const currentFiles = projectData.files || [];
        const oldFile = currentFiles.find((f) => f.name === version.name);
        // Eğer yerel dizin verildiyse, yerel dosyayı yedekle ve yenisini indir
        if (localDirPath) {
            const fs = await import('fs');
            const path = await import('path');
            const localFilePath = path.join(localDirPath, version.name);
            // Eski dosyayı yedekle (varsa)
            if (fs.existsSync(localFilePath)) {
                const backupName = `${version.name}.backup_${Date.now()}`;
                fs.renameSync(localFilePath, path.join(localDirPath, backupName));
            }
            // Versiyonu indir
            try {
                if (version.storageProvider === 'firebase' && version.path) {
                    const sRef = (0, storage_1.ref)(firebase_1.storage, version.path);
                    const blob = await (0, storage_1.getBytes)(sRef);
                    fs.writeFileSync(localFilePath, Buffer.from(blob));
                }
                else if (version.url) {
                    const response = await fetch(version.url);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(localFilePath, buffer);
                }
            }
            catch (downloadErr) {
                electron_log_1.default.error('[VersionService] İndirme hatası:', downloadErr);
                return { success: false, error: `İndirme hatası: ${downloadErr.message}` };
            }
        }
        // Firestore'daki files[] dizisini güncelle
        // arrayRemove + arrayUnion atomik olarak yapılamaz, ama Firestore updateDoc
        // tek bir çağrıda iki alanı da güncelleyebilir
        const updatedFile = {
            name: version.name,
            url: version.url,
            path: version.path,
            size: version.size,
            type: version.type,
            storageProvider: version.storageProvider,
            objectKey: version.objectKey,
            contentType: version.contentType,
            folderId: oldFile?.folderId || null,
            createdAt: new Date().toISOString(),
            uploadedBy: version.uploadedBy,
            status: 'active',
        };
        await (0, firestore_1.runTransaction)(firebase_1.db, async (transaction) => {
            const projectDoc = await transaction.get(projectRef);
            if (!projectDoc.exists()) {
                throw new Error('Proje bulunamadi.');
            }
            const data = projectDoc.data();
            const currentFiles = (data?.files || []);
            const newFiles = currentFiles
                .filter((f) => f.name !== version.name)
                .concat(updatedFile);
            transaction.update(projectRef, {
                files: newFiles,
                activityLog: (0, firestore_1.arrayUnion)({
                    action: 'version_restored',
                    user: version.uploadedBy,
                    timestamp: new Date().toISOString(),
                    details: `${version.name} v${version.versionNumber} versiyonuna geri yüklendi`,
                }),
                updatedAt: (0, firestore_1.serverTimestamp)(),
            });
        });
        return { success: true, restoredUrl: version.url };
    }
    catch (err) {
        electron_log_1.default.error('[VersionService] restoreFileVersion error:', err);
        return { success: false, error: err.message || 'Versiyon geri yüklenemedi.' };
    }
}
/**
 * Versiyona revizyon notu ekle/güncelle
 */
async function updateVersionNote(projectId, versionId, changeNote) {
    try {
        const versionRef = (0, firestore_1.doc)(firebase_1.db, 'projects', projectId, 'fileVersions', versionId);
        await (0, firestore_1.updateDoc)(versionRef, { changeNote });
        return { success: true };
    }
    catch (err) {
        electron_log_1.default.error('[VersionService] updateVersionNote error:', err);
        return { success: false, error: err.message || 'Not güncellenemedi.' };
    }
}
function formatBytes(bytes) {
    if (!bytes)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
