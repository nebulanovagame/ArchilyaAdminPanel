import type { ChildProcess } from 'child_process';
import kill from 'tree-kill';

function killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
  return new Promise((resolve, reject) => {
    kill(pid, signal, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export class ProcessRegistry {
  private readonly processes = new Map<string, ChildProcess>();

  register(key: string, process: ChildProcess): void {
    this.processes.set(key, process);
    process.once('exit', () => {
      this.processes.delete(key);
    });
  }

  has(key: string): boolean {
    return this.processes.has(key);
  }

  get(key: string): ChildProcess | undefined {
    return this.processes.get(key);
  }

  isAlive(key: string): boolean {
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

  listPids(): number[] {
    return Array.from(this.processes.values())
      .map((process) => process.pid)
      .filter((pid): pid is number => typeof pid === 'number');
  }

  async kill(key: string): Promise<void> {
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
    } catch {
      await killProcessTree(process.pid, 'SIGKILL');
    }
  }

  async killAll(): Promise<void> {
    const keys = Array.from(this.processes.keys());
    for (const key of keys) {
      await this.kill(key);
    }
  }

  async killAllSettled(): Promise<void> {
    const keys = Array.from(this.processes.keys());
    await Promise.allSettled(keys.map((key) => this.kill(key)));
  }
}
