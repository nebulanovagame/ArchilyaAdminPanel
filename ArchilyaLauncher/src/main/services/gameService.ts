import type { ChildProcess } from 'child_process';
import { type BrowserWindow } from 'electron';

let gameProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

export function setMainWindowForGameStatus(win: BrowserWindow) {
  mainWindow = win;
}

export function notifyGameStatus(isRunning: boolean) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('game-status-changed', isRunning);
  }
}

export function setGameProcess(proc: ChildProcess | null) {
  if (gameProcess === proc) {
    return;
  }

  gameProcess = proc;
  if (proc) {
    notifyGameStatus(true);
    proc.once('close', () => {
      if (gameProcess === proc) {
        gameProcess = null;
      }
      notifyGameStatus(false);
    });
  } else {
    notifyGameStatus(false);
  }
}

export function isGameRunning(): boolean {
  return gameProcess !== null;
}
