"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBytes = formatBytes;
exports.uploadFileToProject = uploadFileToProject;
exports.deleteFileFromProject = deleteFileFromProject;
const storage_1 = require("firebase/storage");
const firestore_1 = require("firebase/firestore");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const firebase_1 = require("../firebase");
const r2UploadService_1 = require("./r2UploadService");
const uploadSignalService_1 = require("./uploadSignalService");
const versionService_1 = require("./versionService");
const electron_log_1 = __importDefault(require("electron-log"));
function getErrorMessage(error, fallback) {
    return error instanceof Error && error.message ? error.message : fallback;
}
function getFileType(filePath) {
    return path.extname(filePath).replace('.', '').toLowerCase();
}
function formatBytes(bytes) {
    if (!bytes)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
function getContentType(fileType) {
    if (fileType === 'pdf')
        return 'application/pdf';
    if (['dwg', 'dxf'].includes(fileType))
        return 'application/octet-stream';
    return `image/${fileType === 'jpg' ? 'jpeg' : fileType || 'jpeg'}`;
}
function getTypeKey(fileType) {
    if (fileType === 'pdf')
        return 'pdf';
    if (['dwg', 'dxf'].includes(fileType))
        return 'dwg';
    return 'img';
}
async function uploadFileToProject(localFilePath, projectId, win) {
    const user = firebase_1.auth.currentUser;
    if (!user)
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
    const fileName = path.basename(localFilePath);
    const fileType = getFileType(localFilePath);
    const fileStats = fs.statSync(localFilePath);
    const fileSize = fileStats.size;
    const contentType = getContentType(fileType);
    const signalId = `uploading_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const useR2 = (0, r2UploadService_1.shouldUseR2Upload)({ fileName, fileSize, contentType });
    await (0, uploadSignalService_1.upsertProjectUploadSignal)({
        id: signalId,
        userId: user.uid,
        projectId,
        name: fileName,
        size: fileSize,
        contentType,
        folderId: null,
        storageProvider: useR2 ? 'r2' : 'firebase',
        status: 'uploading',
    }).catch(() => null);
    if (useR2) {
        try {
            const uploadMeta = await (0, r2UploadService_1.createR2UploadUrlSecure)({
                projectId,
                fileName,
                fileSize,
                contentType,
            });
            if (!uploadMeta?.success || !uploadMeta?.uploadUrl || !uploadMeta?.objectKey) {
                throw new Error('R2 upload URL olusturulamadi.');
            }
            await (0, r2UploadService_1.uploadFilePathToSignedUrl)(uploadMeta.uploadUrl, localFilePath, contentType, uploadMeta.pseudoUrl);
            const downloadUrl = String(uploadMeta.pseudoUrl || `r2://${uploadMeta.objectKey}`).trim();
            await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
                files: (0, firestore_1.arrayUnion)({
                    name: fileName,
                    url: downloadUrl,
                    path: null,
                    size: fileSize,
                    type: fileType,
                    storageProvider: 'r2',
                    objectKey: String(uploadMeta.objectKey || '').trim() || null,
                    contentType,
                    folderId: null,
                    createdAt: new Date().toISOString(),
                    uploadedBy: user.displayName || user.email || undefined,
                    status: 'active',
                }),
                [`fileCount.${getTypeKey(fileType)}`]: (0, firestore_1.increment)(1),
                totalSize: (0, firestore_1.increment)(fileSize),
                activityLog: (0, firestore_1.arrayUnion)({
                    action: 'file_upload',
                    user: user.displayName || user.email,
                    timestamp: new Date().toISOString(),
                    details: `${fileName} yüklendi (${formatBytes(fileSize)}) — Launcher`,
                }),
                updatedAt: (0, firestore_1.serverTimestamp)(),
            });
            // FAZ 2.5: Versiyon kaydı oluştur
            const uploadedFile = {
                name: fileName,
                url: downloadUrl,
                path: null,
                size: fileSize,
                type: fileType,
                storageProvider: 'r2',
                objectKey: String(uploadMeta.objectKey || '').trim() || null,
                contentType,
                folderId: null,
                createdAt: new Date().toISOString(),
                uploadedBy: user.displayName || user.email || undefined,
                status: 'active',
            };
            void (0, versionService_1.saveFileVersion)(projectId, uploadedFile);
            await (0, uploadSignalService_1.clearProjectUploadSignal)(projectId, signalId).catch(() => null);
            win.webContents.send('upload-complete', { fileName, projectId, downloadUrl });
            return { success: true };
        }
        catch (err) {
            const errorMessage = getErrorMessage(err, 'R2 yukleme hatasi');
            await (0, uploadSignalService_1.upsertProjectUploadSignal)({
                id: signalId,
                userId: user.uid,
                projectId,
                name: fileName,
                size: fileSize,
                contentType,
                folderId: null,
                storageProvider: 'r2',
                status: 'failed',
                lastError: errorMessage,
            }).catch(() => null);
            win.webContents.send('upload-error', { fileName, projectId, error: errorMessage });
            return { success: false, error: errorMessage };
        }
    }
    const storagePath = `users/${user.uid}/projects/${projectId}/${Date.now()}_${fileName}`;
    const sRef = (0, storage_1.ref)(firebase_1.storage, storagePath);
    const fileBuffer = fs.readFileSync(localFilePath);
    const fileBlob = new Uint8Array(fileBuffer);
    return new Promise((resolve) => {
        const uploadTask = (0, storage_1.uploadBytesResumable)(sRef, fileBlob);
        uploadTask.on('state_changed', (snapshot) => {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            win.webContents.send('upload-progress', { fileName, projectId, percent });
        }, (error) => {
            void (0, uploadSignalService_1.upsertProjectUploadSignal)({
                id: signalId,
                userId: user.uid,
                projectId,
                name: fileName,
                size: fileSize,
                contentType,
                folderId: null,
                storageProvider: 'firebase',
                status: 'failed',
                lastError: error.message,
            }).catch(() => null);
            win.webContents.send('upload-error', { fileName, projectId, error: error.message });
            resolve({ success: false, error: error.message });
        }, async () => {
            try {
                const downloadUrl = await (0, storage_1.getDownloadURL)(uploadTask.snapshot.ref);
                await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
                    files: (0, firestore_1.arrayUnion)({
                        name: fileName,
                        url: downloadUrl,
                        path: storagePath,
                        size: fileSize,
                        type: fileType,
                        storageProvider: 'firebase',
                        objectKey: null,
                        contentType,
                        folderId: null,
                        createdAt: new Date().toISOString(),
                        uploadedBy: user.displayName || user.email || undefined,
                        status: 'active',
                    }),
                    [`fileCount.${getTypeKey(fileType)}`]: (0, firestore_1.increment)(1),
                    totalSize: (0, firestore_1.increment)(fileSize),
                    activityLog: (0, firestore_1.arrayUnion)({
                        action: 'file_upload',
                        user: user.displayName || user.email,
                        timestamp: new Date().toISOString(),
                        details: `${fileName} yüklendi (${formatBytes(fileSize)}) — Launcher`,
                    }),
                    updatedAt: (0, firestore_1.serverTimestamp)(),
                });
                // FAZ 2.5: Versiyon kaydı oluştur
                const uploadedFile = {
                    name: fileName,
                    url: downloadUrl,
                    path: storagePath,
                    size: fileSize,
                    type: fileType,
                    storageProvider: 'firebase',
                    objectKey: null,
                    contentType,
                    folderId: null,
                    createdAt: new Date().toISOString(),
                    uploadedBy: user.displayName || user.email || undefined,
                    status: 'active',
                };
                void (0, versionService_1.saveFileVersion)(projectId, uploadedFile);
                await (0, uploadSignalService_1.clearProjectUploadSignal)(projectId, signalId).catch(() => null);
                win.webContents.send('upload-complete', { fileName, projectId, downloadUrl });
                resolve({ success: true });
            }
            catch (err) {
                electron_log_1.default.error('Yükleme sonrası hata:', err);
                resolve({ success: false, error: getErrorMessage(err, 'Yükleme tamamlandı ama kayıt hatası') });
            }
        });
    });
}
async function deleteFileFromProject(projectId, file) {
    const user = firebase_1.auth.currentUser;
    if (!user)
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
    try {
        const typeKey = file.type === 'pdf'
            ? 'pdf'
            : ['dwg', 'dxf'].includes(file.type)
                ? 'dwg'
                : 'img';
        const trashedFile = {
            ...file,
            status: 'trashed',
            deletedAt: new Date().toISOString(),
            deletedBy: user.displayName || user.email || user.uid,
        };
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
            files: (0, firestore_1.arrayRemove)(file),
            deletedFiles: (0, firestore_1.arrayUnion)(trashedFile),
            [`fileCount.${typeKey}`]: (0, firestore_1.increment)(-1),
            totalSize: (0, firestore_1.increment)(-(file.size || 0)),
            activityLog: (0, firestore_1.arrayUnion)({
                action: 'file_delete',
                user: user.displayName || user.email,
                timestamp: new Date().toISOString(),
                details: `${file.name} cop kutusuna tasindi (soft delete, Launcher)`,
            }),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        return { success: true };
    }
    catch (err) {
        return { success: false, error: getErrorMessage(err, 'Dosya silinemedi.') };
    }
}
