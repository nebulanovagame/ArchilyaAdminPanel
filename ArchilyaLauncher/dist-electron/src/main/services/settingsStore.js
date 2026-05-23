"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSettings = void 0;
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
const electron_store_1 = __importDefault(require("electron-store"));
exports.defaultSettings = {
    autoStart: true,
    backgroundSync: true,
    wifiOnly: false,
    notifSync: true,
    notifLock: true,
    notifProject: false,
    notifSystem: true,
    syncSpeed: 'unlimited',
    themeMode: 'dark',
    storagePath: 'C:\\Belgelerim\\Archilya',
};
const store = new electron_store_1.default({
    name: 'launcher-settings',
    defaults: exports.defaultSettings,
});
function getSettings() {
    return {
        autoStart: store.get('autoStart', exports.defaultSettings.autoStart),
        backgroundSync: store.get('backgroundSync', exports.defaultSettings.backgroundSync),
        wifiOnly: store.get('wifiOnly', exports.defaultSettings.wifiOnly),
        notifSync: store.get('notifSync', exports.defaultSettings.notifSync),
        notifLock: store.get('notifLock', exports.defaultSettings.notifLock),
        notifProject: store.get('notifProject', exports.defaultSettings.notifProject),
        notifSystem: store.get('notifSystem', exports.defaultSettings.notifSystem),
        syncSpeed: store.get('syncSpeed', exports.defaultSettings.syncSpeed),
        themeMode: store.get('themeMode', exports.defaultSettings.themeMode),
        storagePath: store.get('storagePath', exports.defaultSettings.storagePath),
    };
}
function updateSettings(settings) {
    store.set(settings);
    return getSettings();
}
