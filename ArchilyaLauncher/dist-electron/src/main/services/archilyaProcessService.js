"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startArchilyaProcess = startArchilyaProcess;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
function startArchilyaProcess(executablePath, args, options = {}) {
    return (0, child_process_1.spawn)(executablePath, args, {
        detached: true,
        cwd: path_1.default.dirname(executablePath),
        stdio: 'ignore',
        windowsHide: options.windowsHide ?? true,
    });
}
