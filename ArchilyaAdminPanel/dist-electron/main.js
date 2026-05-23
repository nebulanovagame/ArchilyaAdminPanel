"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const adminIPC_1 = require("./adminIPC");
process.env.DIST = path_1.default.join(__dirname, '../dist');
process.env.VITE_PUBLIC = electron_1.app.isPackaged ? process.env.DIST : path_1.default.join(process.env.DIST, '../public');
let win;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
function createWindow() {
    win = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#1e1e1e', // Dark theme background
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Setup Admin IPC handlers
    (0, adminIPC_1.setupAdminIPC)();
    if (!electron_1.app.isPackaged || !!process.env.VITE_DEV_SERVER_URL) {
        const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
        win.loadURL(devUrl);
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path_1.default.join(process.env.DIST || '', 'index.html'));
    }
}
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.whenReady().then(createWindow);
