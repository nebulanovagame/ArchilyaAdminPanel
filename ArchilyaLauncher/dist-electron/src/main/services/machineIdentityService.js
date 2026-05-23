"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateMachineId = getOrCreateMachineId;
exports.getMachineIdentityMetadata = getMachineIdentityMetadata;
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const electron_store_1 = __importDefault(require("electron-store"));
const store = new electron_store_1.default({
    name: 'archilya-launcher-machine',
});
function getOrCreateMachineId() {
    const existing = store.get('machineId');
    if (existing) {
        return existing;
    }
    const machineId = `arch-${(0, crypto_1.randomUUID)()}`;
    store.set('machineId', machineId);
    return machineId;
}
function getMachineIdentityMetadata() {
    return {
        machineId: getOrCreateMachineId(),
        hostname: os_1.default.hostname(),
        platform: process.platform,
        arch: process.arch,
    };
}
