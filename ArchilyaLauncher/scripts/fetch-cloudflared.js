#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(PROJECT_ROOT, 'TunnelTools');
const TARGET_BINARY = path.join(TOOLS_DIR, 'cloudflared.exe');
const DOWNLOAD_URL =
  process.env.CLOUDFLARED_DOWNLOAD_URL
  || 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode
        && response.statusCode >= 300
        && response.statusCode < 400
        && response.headers.location
      ) {
        response.destroy();
        const redirected = new URL(response.headers.location, url).toString();
        downloadFile(redirected, destination).then(resolve).catch(reject);
        return;
      }

      if (!response.statusCode || response.statusCode >= 400) {
        reject(new Error(`cloudflared indirilemedi. HTTP ${response.statusCode || 'ERR'}`));
        return;
      }

      const file = fs.createWriteStream(destination);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => resolve());
      });

      file.on('error', (error) => {
        file.close(() => {
          fs.rmSync(destination, { force: true });
          reject(error);
        });
      });
    });

    request.on('error', reject);
    request.setTimeout(60000, () => {
      request.destroy(new Error('cloudflared indirme zaman asimi.'));
    });
  });
}

function verifyBinary(binaryPath) {
  const result = spawnSync(binaryPath, ['--version'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`cloudflared doğrulaması başarısız: ${result.stderr || result.stdout}`);
  }

  const output = (result.stdout || '').trim();
  if (!output.toLowerCase().includes('cloudflared')) {
    throw new Error(`cloudflared doğrulaması beklenmeyen çıktı üretti: ${output}`);
  }

  return output;
}

async function main() {
  ensureDir(TOOLS_DIR);

  if (existsFile(TARGET_BINARY)) {
    try {
      const version = verifyBinary(TARGET_BINARY);
      console.log(`[fetch-cloudflared] Var olan binary kullanılıyor: ${version}`);
      return;
    } catch {
      console.log('[fetch-cloudflared] Mevcut binary bozuk/güncel değil, tekrar indirilecek...');
      fs.rmSync(TARGET_BINARY, { force: true });
    }
  }

  const tempFile = `${TARGET_BINARY}.tmp`;
  if (existsFile(tempFile)) {
    fs.rmSync(tempFile, { force: true });
  }

  console.log(`[fetch-cloudflared] İndiriliyor: ${DOWNLOAD_URL}`);
  await downloadFile(DOWNLOAD_URL, tempFile);

  fs.renameSync(tempFile, TARGET_BINARY);
  const version = verifyBinary(TARGET_BINARY);
  console.log(`[fetch-cloudflared] Hazır: ${TARGET_BINARY}`);
  console.log(`[fetch-cloudflared] ${version}`);
}

main().catch((error) => {
  console.error('[fetch-cloudflared] Hata:', error instanceof Error ? error.message : error);
  process.exit(1);
});
