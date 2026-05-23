"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMainWindowForGameStatus = setMainWindowForGameStatus;
exports.notifyGameStatus = notifyGameStatus;
exports.setGameProcess = setGameProcess;
exports.isGameRunning = isGameRunning;
let gameProcess = null;
let mainWindow = null;
function setMainWindowForGameStatus(win) {
    mainWindow = win;
}
function notifyGameStatus(isRunning) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-status-changed', isRunning);
    }
}
function setGameProcess(proc) {
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
    }
    else {
        notifyGameStatus(false);
    }
}
function isGameRunning() {
    return gameProcess !== null;
}
