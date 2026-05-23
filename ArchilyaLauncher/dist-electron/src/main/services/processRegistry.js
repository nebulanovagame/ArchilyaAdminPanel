"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessRegistry = void 0;
const tree_kill_1 = __importDefault(require("tree-kill"));
function killProcessTree(pid, signal = 'SIGTERM') {
    return new Promise((resolve, reject) => {
        (0, tree_kill_1.default)(pid, signal, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
class ProcessRegistry {
    processes = new Map();
    register(key, process) {
        this.processes.set(key, process);
        process.once('exit', () => {
            this.processes.delete(key);
        });
    }
    has(key) {
        return this.processes.has(key);
    }
    get(key) {
        return this.processes.get(key);
    }
    isAlive(key) {
        const process = this.processes.get(key);
        if (!process) {
            return false;
        }
        if (!process.pid || process.killed || process.exitCode !== null || process.signalCode !== null) {
            this.processes.delete(key);
            return false;
        }
        return true;
    }
    listPids() {
        return Array.from(this.processes.values())
            .map((process) => process.pid)
            .filter((pid) => typeof pid === 'number');
    }
    async kill(key) {
        const process = this.processes.get(key);
        if (!process) {
            return;
        }
        this.processes.delete(key);
        if (!process.pid) {
            process.kill();
            return;
        }
        try {
            await killProcessTree(process.pid, 'SIGTERM');
        }
        catch {
            await killProcessTree(process.pid, 'SIGKILL');
        }
    }
    async killAll() {
        const keys = Array.from(this.processes.keys());
        for (const key of keys) {
            await this.kill(key);
        }
    }
    async killAllSettled() {
        const keys = Array.from(this.processes.keys());
        await Promise.allSettled(keys.map((key) => this.kill(key)));
    }
}
exports.ProcessRegistry = ProcessRegistry;
