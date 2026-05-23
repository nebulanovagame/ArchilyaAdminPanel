"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVrProjects = getVrProjects;
exports.getAssignedVrProjects = getAssignedVrProjects;
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../firebase");
const authService_1 = require("./authService");
const electron_log_1 = __importDefault(require("electron-log"));
/**
 * Admin Paneli Firestore şeması (products koleksiyonu):
 *   title      : string
 *   mapName    : string  ← Admin Panel camelCase kullanıyor
 *   chunkId    : number
 *   files      : { name, url, size }[]
 *   assignedTo : string  (UID)
 *   createdAt  : Timestamp
 *
 * Kullanıcı belgesi (users/{uid}):
 *   owned_project_ids : string[]  ← sahip olunan product ID'leri
 */
/** Firestore products dokümanını VrProject tipine dönüştür */
const PUBLIC_DEMO_CATEGORY = 'demo_map';
function asNonEmptyString(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}
function normalizeCategory(value) {
    const category = asNonEmptyString(value).toLowerCase();
    return category || undefined;
}
function extractR2ObjectKey(url) {
    const trimmedUrl = asNonEmptyString(url);
    if (!trimmedUrl.toLowerCase().startsWith('r2://')) {
        return '';
    }
    return trimmedUrl.slice(5).trim();
}
function normalizeStorageProvider(value) {
    const provider = asNonEmptyString(value).toLowerCase();
    return provider || undefined;
}
function mapProductFiles(filesValue) {
    if (!Array.isArray(filesValue)) {
        return [];
    }
    return filesValue
        .map((file) => {
        const fileData = (file || {});
        const name = asNonEmptyString(fileData.name);
        const url = asNonEmptyString(fileData.url);
        const objectKey = asNonEmptyString(fileData.objectKey) || extractR2ObjectKey(url);
        const storageProvider = normalizeStorageProvider(fileData.storageProvider)
            || (objectKey ? 'r2' : undefined);
        const contentType = asNonEmptyString(fileData.contentType) || undefined;
        if (!name || !url) {
            return null;
        }
        const rawSize = fileData.size;
        const parsedSize = typeof rawSize === 'number'
            ? rawSize
            : typeof rawSize === 'string'
                ? Number(rawSize)
                : 0;
        const mappedFile = {
            name,
            url,
            size: Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 0,
        };
        if (storageProvider) {
            mappedFile.storageProvider = storageProvider;
        }
        if (objectKey) {
            mappedFile.objectKey = objectKey;
        }
        if (contentType) {
            mappedFile.contentType = contentType;
        }
        return mappedFile;
    })
        .filter((file) => Boolean(file));
}
function mapProductDoc(id, data) {
    const mapName = asNonEmptyString(data.mapName) || asNonEmptyString(data.map_name);
    const files = mapProductFiles(data.files);
    if (!mapName || files.length === 0) {
        return null;
    }
    const category = normalizeCategory(data.category);
    return {
        id,
        title: asNonEmptyString(data.title) || 'İsimsiz Proje',
        map_name: mapName,
        vrMapName: asNonEmptyString(data.vrMapName) || asNonEmptyString(data.vr_map_name) || mapName,
        webShareMapName: asNonEmptyString(data.webShareMapName) || asNonEmptyString(data.web_share_map_name) || mapName,
        category,
        isPublicDemo: category === PUBLIC_DEMO_CATEGORY,
        files,
    };
}
async function fetchProductsByIds(ids) {
    if (ids.length === 0) {
        return [];
    }
    const normalizedIds = ids.map((id) => asNonEmptyString(id)).filter(Boolean);
    if (normalizedIds.length === 0) {
        return [];
    }
    const uniqueIds = Array.from(new Set(normalizedIds));
    const projectsById = new Map();
    const CHUNK_SIZE = 30;
    for (let index = 0; index < uniqueIds.length; index += CHUNK_SIZE) {
        const chunk = uniqueIds.slice(index, index + CHUNK_SIZE);
        const chunkResults = await Promise.allSettled(chunk.map((productId) => (0, firestore_1.getDoc)((0, firestore_1.doc)(firebase_1.db, 'products', productId))));
        chunkResults.forEach((result, chunkIndex) => {
            if (result.status !== 'fulfilled') {
                electron_log_1.default.warn('[vrProjectService] fetchProductsByIds read failed:', {
                    productId: chunk[chunkIndex],
                    error: result.reason,
                });
                return;
            }
            const productSnap = result.value;
            if (!productSnap.exists()) {
                return;
            }
            const project = mapProductDoc(productSnap.id, productSnap.data());
            if (project) {
                projectsById.set(project.id, project);
            }
        });
    }
    return uniqueIds
        .map((productId) => projectsById.get(productId))
        .filter((project) => Boolean(project));
}
async function fetchProductsByAssignedUser(uid) {
    const productsQuery = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'products'), (0, firestore_1.where)('assignedTo', '==', uid));
    const snapshot = await (0, firestore_1.getDocs)(productsQuery);
    return snapshot.docs
        .map((productDoc) => mapProductDoc(productDoc.id, productDoc.data()))
        .filter((project) => Boolean(project));
}
async function fetchPublicDemoProducts() {
    const publicDemoQuery = (0, firestore_1.query)((0, firestore_1.collection)(firebase_1.db, 'products'), (0, firestore_1.where)('category', '==', PUBLIC_DEMO_CATEGORY));
    const snapshot = await (0, firestore_1.getDocs)(publicDemoQuery);
    return snapshot.docs
        .map((productDoc) => mapProductDoc(productDoc.id, productDoc.data()))
        .filter((project) => Boolean(project));
}
function mergeOwnedAndAssignedProjects(ownedIds, ownedProjects, assignedProjects) {
    const mergedProjects = new Map();
    const idOrder = new Map();
    ownedIds.forEach((id, index) => {
        idOrder.set(id, index);
    });
    let assignedOrder = ownedIds.length;
    for (const project of assignedProjects) {
        if (!idOrder.has(project.id)) {
            idOrder.set(project.id, assignedOrder);
            assignedOrder += 1;
        }
        mergedProjects.set(project.id, project);
    }
    for (const project of ownedProjects) {
        mergedProjects.set(project.id, project);
    }
    return Array.from(mergedProjects.values()).sort((left, right) => (idOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (idOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER));
}
function mergeProjectsInPriorityOrder(...groups) {
    const seenIds = new Set();
    const merged = [];
    for (const group of groups) {
        for (const project of group) {
            if (seenIds.has(project.id)) {
                continue;
            }
            seenIds.add(project.id);
            merged.push(project);
        }
    }
    return merged;
}
/**
 * Oturum açmış kullanıcının sahip olduğu VR projelerini çeker.
 * Adımlar:
 *  1. users/{uid} belgesinden owned_project_ids dizisini oku
 *  2. Her ID için products/{id} belgesini getir
 *  3. VrProject dizisine dönüştür
 */
async function getVrProjects() {
    let publicDemoProjects = [];
    try {
        publicDemoProjects = await fetchPublicDemoProducts();
    }
    catch (err) {
        electron_log_1.default.error('[vrProjectService] fetchPublicDemoProducts error:', {
            error: err,
        });
    }
    const user = (0, authService_1.getCurrentUser)();
    if (!user || user.isGuest) {
        return mergeProjectsInPriorityOrder(publicDemoProjects);
    }
    try {
        const userRef = (0, firestore_1.doc)(firebase_1.db, 'users', user.uid);
        const userSnap = await (0, firestore_1.getDoc)(userRef);
        const ownedIds = userSnap.exists()
            ? (userSnap.data().owned_project_ids || [])
            : [];
        const [ownedProjects, assignedProjects] = await Promise.all([
            fetchProductsByIds(ownedIds),
            fetchProductsByAssignedUser(user.uid),
        ]);
        const ownedAndAssignedProjects = mergeOwnedAndAssignedProjects(ownedIds, ownedProjects, assignedProjects);
        return mergeProjectsInPriorityOrder(publicDemoProjects, ownedAndAssignedProjects);
    }
    catch (err) {
        electron_log_1.default.error('[vrProjectService] getVrProjects error:', {
            uid: user.uid,
            email: user.email,
            error: err,
        });
        return mergeProjectsInPriorityOrder(publicDemoProjects);
    }
}
async function getAssignedVrProjects(uid) {
    const assignedProjects = await fetchProductsByAssignedUser(uid);
    return mergeProjectsInPriorityOrder(assignedProjects);
}
