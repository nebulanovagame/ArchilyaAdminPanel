"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldUseR2Upload = shouldUseR2Upload;
exports.createR2UploadUrlSecure = createR2UploadUrlSecure;
exports.uploadFilePathToSignedUrl = uploadFilePathToSignedUrl;
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const functions_1 = require("firebase/functions");
const firebase_1 = require("../firebase");
const createR2UploadUrlSecureCallable = (0, functions_1.httpsCallable)(firebase_1.functions, 'createR2UploadUrlSecure');
const R2_SIZE_THRESHOLD_BYTES = 50 * 1024 * 1024;
const R2_EXTENSIONS = new Set(['pak', 'utoc', 'ucas', 'mp4', 'mov', 'avi', 'mkv', 'zip', 'rar', '7z', 'glb', 'gltf', 'fbx', 'obj', 'blend', 'usdz']);
const DEFAULT_ALLOWED_R2_HOST_SUFFIXES = ['.r2.cloudflarestorage.com', '.cloudflarestorage.com'];
function normalizeText(value) {
    return String(value || '').trim();
}
function getExtension(fileName = '') {
    const parts = String(fileName || '').split('.');
    return parts.length > 1 ? String(parts.pop() || '').toLowerCase() : '';
}
function getLoopbackHosts() {
    return new Set(['localhost', '127.0.0.1', '::1']);
}
function getConfiguredAllowedHosts() {
    return String(process.env.ARCHILYA_R2_UPLOAD_HOSTS || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}
function isAllowedR2Host(hostname, expectedPublicUrl) {
    const normalizedHost = hostname.toLowerCase();
    const configuredHosts = getConfiguredAllowedHosts();
    if (configuredHosts.includes(normalizedHost)) {
        return true;
    }
    if (DEFAULT_ALLOWED_R2_HOST_SUFFIXES.some((suffix) => normalizedHost === suffix.slice(1) || normalizedHost.endsWith(suffix))) {
        return true;
    }
    const normalizedPublicUrl = normalizeText(expectedPublicUrl);
    if (normalizedPublicUrl.startsWith('https://')) {
        try {
            const publicUrlHost = new URL(normalizedPublicUrl).hostname.toLowerCase();
            if (configuredHosts.includes(publicUrlHost)) {
                return normalizedHost === publicUrlHost;
            }
        }
        catch {
            return false;
        }
    }
    return false;
}
function getValidatedUploadUrl(uploadUrl, expectedPublicUrl) {
    const parsedUrl = new URL(uploadUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    const isLoopbackHost = getLoopbackHosts().has(hostname);
    const isAllowedProtocol = parsedUrl.protocol === 'https:' || (isLoopbackHost && parsedUrl.protocol === 'http:');
    if (!isAllowedProtocol) {
        throw new Error('Gecersiz R2 upload hedefi.');
    }
    if (!isLoopbackHost && !isAllowedR2Host(hostname, expectedPublicUrl)) {
        throw new Error('Beklenmeyen R2 upload hedefi.');
    }
    return parsedUrl.toString();
}
function shouldUseR2Upload({ fileName = '', fileSize = 0, contentType = '' } = {}) {
    const ext = getExtension(fileName);
    const normalizedType = String(contentType || '').toLowerCase();
    const largeBySize = Number(fileSize || 0) >= R2_SIZE_THRESHOLD_BYTES;
    const heavyByExt = R2_EXTENSIONS.has(ext);
    const heavyByType = /video|octet-stream|model/.test(normalizedType);
    return largeBySize || heavyByExt || heavyByType;
}
async function createR2UploadUrlSecure(payload) {
    if (!firebase_1.auth.currentUser) {
        throw new Error('Oturum açmanız gerekiyor.');
    }
    const result = await createR2UploadUrlSecureCallable(payload || {});
    const data = result?.data;
    if (!data || typeof data !== 'object') {
        return { success: false };
    }
    const response = data;
    return {
        success: response.success === true,
        uploadUrl: typeof response.uploadUrl === 'string' ? response.uploadUrl : undefined,
        objectKey: typeof response.objectKey === 'string' ? response.objectKey : undefined,
        pseudoUrl: typeof response.pseudoUrl === 'string' ? response.pseudoUrl : undefined,
    };
}
async function uploadFilePathToSignedUrl(uploadUrl, localFilePath, contentType = 'application/octet-stream', expectedPublicUrl) {
    const normalizedUploadUrl = normalizeText(uploadUrl);
    const safeLocalFilePath = normalizeText(localFilePath);
    if (!normalizedUploadUrl || !safeLocalFilePath) {
        throw new Error('R2 upload bilgileri eksik.');
    }
    const safeUploadUrl = getValidatedUploadUrl(normalizedUploadUrl, expectedPublicUrl);
    const stats = await fs_1.default.promises.stat(safeLocalFilePath);
    const stream = fs_1.default.createReadStream(safeLocalFilePath, { highWaterMark: 1024 * 1024 });
    try {
        const response = await axios_1.default.put(safeUploadUrl, stream, {
            headers: {
                'Content-Type': String(contentType || 'application/octet-stream'),
                'Content-Length': String(stats.size),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        return {
            success: true,
            status: response.status,
            size: Number(stats.size || 0),
        };
    }
    finally {
        stream.destroy();
    }
}
