import { ipcMain, app } from 'electron';
import fs from 'fs';
import http from 'http';
import https from 'https';

interface SignedUploadInput {
  uploadUrl: string;
  filePath: string;
  contentType?: string;
}

interface SignedUploadResult {
  success: boolean;
  status: number;
}

function uploadFileToSignedUrl(input: SignedUploadInput): Promise<SignedUploadResult> {
  const uploadUrl = String(input.uploadUrl || '').trim();
  const filePath = String(input.filePath || '').trim();
  const contentType = String(input.contentType || '').trim() || 'application/octet-stream';

  if (!uploadUrl) {
    throw new Error('uploadUrl zorunludur.');
  }

  if (!filePath) {
    throw new Error('filePath zorunludur.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Yuklenecek dosya bulunamadi: ${filePath}`);
  }

  const target = new URL(uploadUrl);
  const requestClient = target.protocol === 'https:' ? https : http;

  return new Promise<SignedUploadResult>((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);

    readStream.on('error', (streamError) => {
      reject(streamError);
    });

    fs.promises
      .stat(filePath)
      .then((stats) => {
        const request = requestClient.request(
          {
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port || undefined,
            method: 'PUT',
            path: `${target.pathname}${target.search}`,
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(stats.size),
            },
          },
          (response) => {
            const status = Number(response.statusCode || 0);
            const chunks: Buffer[] = [];

            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => {
              if (status >= 200 && status < 300) {
                resolve({ success: true, status });
                return;
              }

              const body = Buffer.concat(chunks).toString('utf8').slice(0, 500);
              reject(new Error(`R2 upload hatasi (${status}). ${body}`.trim()));
            });
          },
        );

        request.on('error', (requestError) => {
          reject(requestError);
        });

        readStream.pipe(request);
      })
      .catch((statError) => {
        reject(statError);
      });
  });
}

export function setupAdminIPC() {
  ipcMain.removeHandler('get-app-version');
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.removeHandler('upload-file-to-signed-url');
  ipcMain.handle('upload-file-to-signed-url', async (_event, input: SignedUploadInput) => {
    return uploadFileToSignedUrl(input);
  });

  // Future backend logic for the Admin Panel can be added here.
  // Currently, the core file upload and database logic is handled 
  // by the Firebase Client SDK in the renderer process as requested.
}
