import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

export interface ArchilyaProcessOptions {
  windowsHide?: boolean;
}

export function startArchilyaProcess(
  executablePath: string,
  args: string[],
  options: ArchilyaProcessOptions = {},
): ChildProcess {
  return spawn(executablePath, args, {
    detached: true,
    cwd: path.dirname(executablePath),
    stdio: 'ignore',
    windowsHide: options.windowsHide ?? true,
  });
}
