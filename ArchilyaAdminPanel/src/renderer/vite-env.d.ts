/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getAppVersion: () => Promise<string>;
    uploadFileToSignedUrl: (input: {
      uploadUrl: string;
      filePath: string;
      contentType?: string;
    }) => Promise<{ success: boolean; status: number }>;
  }
}
