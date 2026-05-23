"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToProjects = subscribeToProjects;
exports.addProject = addProject;
exports.updateProject = updateProject;
exports.deleteProject = deleteProject;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../firebase");
const electron_log_1 = __importDefault(require("electron-log"));
// Firestore doc → FirebaseProject objesi
function mapDoc(d) {
    const allFiles = (d.files || []);
    const activeFiles = allFiles.filter((f) => f.status !== 'trashed');
    const deletedFiles = [
        ...(d.deletedFiles || []),
        ...allFiles.filter((f) => f.status === 'trashed'),
    ];
    return {
        id: d.id,
        name: d.name || '',
        description: d.description || '',
        status: d.status || 'Aktif',
        location: d.location || '',
        uid: d.uid || '',
        memberUids: d.memberUids || [],
        team: (d.team || []),
        // ── Mimari dosyalar (web paneli) ──
        files: activeFiles,
        deletedFiles,
        fileCount: d.fileCount || { pdf: 0, dwg: 0, img: 0 },
        totalSize: d.totalSize || 0,
        // ── PAK / VR Build sistemi (sadece Launcher) ──
        pak_files: (d.pak_files || []),
        map_name: d.map_name || '',
        vr_builds: (d.vr_builds || []),
        activityLog: (d.activityLog || []),
        isDeleted: d.isDeleted || false,
        createdAt: d.createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
    };
}
// ── Real-time Subscribe ──────────────────────────────────────────────────────
function subscribeToProjects(uid, callback, onError) {
    const q = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'projects'), (0, firestore_1.where)('memberUids', 'array-contains', uid));
    return (0, firestore_1.onSnapshot)(q, (snapshot) => {
        const projects = snapshot.docs
            .map((d) => mapDoc({ id: d.id, ...d.data() }))
            .filter((p) => !p.isDeleted)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        callback(projects);
    }, (err) => {
        electron_log_1.default.error('[projectService] Firestore snapshot error:', err);
        onError?.(err);
    });
}
// ── Add Project ──────────────────────────────────────────────────────────────
async function addProject(data) {
    const user = firebase_1.auth.currentUser;
    if (!user)
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
    try {
        const ref = await (0, firestore_1.addDoc)((0, firestore_1.collection)(firebase_1.db, 'projects'), {
            name: data.name.trim(),
            description: data.description.trim(),
            status: data.status,
            location: data.location.trim(),
            uid: user.uid,
            memberUids: [user.uid],
            // Mimari dosyalar — boş başlar
            files: [],
            deletedFiles: [],
            fileCount: { pdf: 0, dwg: 0, img: 0 },
            totalSize: 0,
            // PAK sistemi — boş başlar, sadece Launcher doldurur
            pak_files: [],
            map_name: '',
            vr_builds: [],
            activityLog: [{
                    action: 'create',
                    user: user.displayName || user.email,
                    timestamp: new Date().toISOString(),
                    details: 'Proje oluşturuldu (Launcher)',
                }],
            team: [{ uid: user.uid, email: user.email, role: 'owner' }],
            invites: [],
            isDeleted: false,
            deletedAt: null,
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        return { success: true, id: ref.id };
    }
    catch (err) {
        electron_log_1.default.error('[projectService] addProject error:', err);
        return { success: false, error: err.message };
    }
}
// ── Update Project (mimari bilgiler) ─────────────────────────────────────────
async function updateProject(projectId, data) {
    const user = firebase_1.auth.currentUser;
    if (!user)
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
    try {
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
            ...data,
            activityLog: (0, firestore_1.arrayUnion)({
                action: 'update',
                user: user.displayName || user.email,
                timestamp: new Date().toISOString(),
                details: 'Proje bilgileri güncellendi (Launcher)',
            }),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
// ── Soft Delete ──────────────────────────────────────────────────────────────
async function deleteProject(projectId) {
    const user = firebase_1.auth.currentUser;
    if (!user)
        return { success: false, error: 'Oturum açmanız gerekiyor.' };
    try {
        await (0, firestore_1.updateDoc)((0, firestore_1.doc)(firebase_1.db, 'projects', projectId), {
            isDeleted: true,
            deletedAt: (0, firestore_1.serverTimestamp)(),
            activityLog: (0, firestore_1.arrayUnion)({
                action: 'delete',
                user: user.displayName || user.email,
                timestamp: new Date().toISOString(),
                details: 'Proje çöp kutusuna taşındı (Launcher)',
            }),
            updatedAt: (0, firestore_1.serverTimestamp)(),
        });
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
