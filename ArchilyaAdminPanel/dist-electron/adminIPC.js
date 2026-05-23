"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdminIPC = setupAdminIPC;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
function uploadFileToSignedUrl(input) {
    const uploadUrl = String(input.uploadUrl || '').trim();
    const filePath = String(input.filePath || '').trim();
    const contentType = String(input.contentType || '').trim() || 'application/octet-stream';
    if (!uploadUrl) {
        throw new Error('uploadUrl zorunludur.');
    }
    if (!filePath) {
        throw new Error('filePath zorunludur.');
    }
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Yuklenecek dosya bulunamadi: ${filePath}`);
    }
    const target = new URL(uploadUrl);
    const requestClient = target.protocol === 'https:' ? https_1.default : http_1.default;
    return new Promise((resolve, reject) => {
        const readStream = fs_1.default.createReadStream(filePath);
        readStream.on('error', (streamError) => {
            reject(streamError);
        });
        fs_1.default.promises
            .stat(filePath)
            .then((stats) => {
            const request = requestClient.request({
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port || undefined,
                method: 'PUT',
                path: `${target.pathname}${target.search}`,
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(stats.size),
                },
            }, (response) => {
                const status = Number(response.statusCode || 0);
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    if (status >= 200 && status < 300) {
                        resolve({ success: true, status });
                        return;
                    }
                    const body = Buffer.concat(chunks).toString('utf8').slice(0, 500);
                    reject(new Error(`R2 upload hatasi (${status}). ${body}`.trim()));
                });
            });
            request.on('error', (requestError) => {
                reject(requestError);
            });
            readStream.pipe(request);
        })
            .catch((statError) => {
            reject(statError);
        });
    });
}
function setupAdminIPC() {
    electron_1.ipcMain.removeHandler('get-app-version');
    electron_1.ipcMain.handle('get-app-version', () => {
        return electron_1.app.getVersion();
    });
    electron_1.ipcMain.removeHandler('upload-file-to-signed-url');
    electron_1.ipcMain.handle('upload-file-to-signed-url', async (_event, input) => {
        return uploadFileToSignedUrl(input);
    });
    // Future backend logic for the Admin Panel can be added here.
    // Currently, the core file upload and database logic is handled 
    // by the Firebase Client SDK in the renderer process as requested.
}
