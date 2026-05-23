import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  uploadFileToSignedUrl: (input: { uploadUrl: string; filePath: string; contentType?: string }) =>
    ipcRenderer.invoke('upload-file-to-signed-url', input),
});
