#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(PROJECT_ROOT, 'SignallingWebServer');
const PREFERRED_UE_VERSION = process.env.UE_VERSION_PREFERRED || 'UE_5.6';

const EPIC_ROOT_CANDIDATES = [
  process.env.EPIC_GAMES_ROOT,
  'C:\\Program Files\\Epic Games',
  'C:\\Program Files (x86)\\Epic Games',
].filter(Boolean);

function existsDir(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function parseUeVersion(folderName) {
  const match = /^UE_(\d+)\.(\d+)(?:\.(\d+))?$/.exec(folderName);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] || 0),
  };
}

function compareVersionDesc(a, b) {
  if (a.version.major !== b.version.major) {
    return b.version.major - a.version.major;
  }
  if (a.version.minor !== b.version.minor) {
    return b.version.minor - a.version.minor;
  }
  return b.version.patch - a.version.patch;
}

function getUeCandidates() {
  const candidates = [];

  for (const root of EPIC_ROOT_CANDIDATES) {
    if (!existsDir(root)) {
      continue;
    }

    const dirs = fs.readdirSync(root, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) {
        continue;
      }

      const parsed = parseUeVersion(dir.name);
      if (!parsed || parsed.major !== 5) {
        continue;
      }

      candidates.push({
        root,
        folder: dir.name,
        fullPath: path.join(root, dir.name),
        version: parsed,
      });
    }
  }

  candidates.sort(compareVersionDesc);
  return candidates;
}

function resolveSignallingSource(ueInstallPath) {
  const sourceDir = path.join(
    ueInstallPath,
    'Engine',
    'Plugins',
    'Media',
    'PixelStreaming',
    'Resources',
    'WebServers',
    'SignallingWebServer',
  );

  const indexPath = path.join(sourceDir, 'dist', 'index.js');
  if (!existsDir(sourceDir) || !fs.existsSync(indexPath)) {
    return null;
  }

  return { sourceDir, indexPath };
}

function findBestSource(candidates) {
  if (candidates.length === 0) {
    return null;
  }

  const preferred = PREFERRED_UE_VERSION
    ? candidates.find((candidate) => candidate.folder === PREFERRED_UE_VERSION)
    : null;
  const ordered = preferred
    ? [preferred, ...candidates.filter((candidate) => candidate !== preferred)]
    : candidates;

  for (const candidate of ordered) {
    const source = resolveSignallingSource(candidate.fullPath);
    if (!source) {
      continue;
    }

    return {
      candidate,
      source,
    };
  }

  return null;
}

function copySignallingFolder(sourceDir, targetDir) {
  if (existsDir(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function hasRuntimeDependenciesInstalled(targetDir) {
  const expressPkg = path.join(targetDir, 'node_modules', 'express', 'package.json');
  const signallingLibPkg = path.join(
    targetDir,
    'node_modules',
    '@epicgames-ps',
    'lib-pixelstreamingsignalling-ue5.6',
    'package.json',
  );

  return existsFile(expressPkg) && existsFile(signallingLibPkg);
}

function installRuntimeDependencies(targetDir) {
  if (hasRuntimeDependenciesInstalled(targetDir)) {
    console.log('[fetch-signalling] Runtime dependencies zaten mevcut, npm install atlandi.');
    return;
  }

  console.log('[fetch-signalling] Runtime dependencies eksik, npm install --omit=dev calisiyor...');
  const installArgs = ['install', '--omit=dev', '--no-audit', '--no-fund'];
  const npmCliPath = process.env.npm_execpath;

  let result;
  if (npmCliPath && existsFile(npmCliPath)) {
    result = spawnSync(process.execPath, [npmCliPath, ...installArgs], {
      cwd: targetDir,
      stdio: 'inherit',
    });
  } else {
    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    result = spawnSync(npmExecutable, installArgs, {
      cwd: targetDir,
      stdio: 'inherit',
    });
  }

  if (result.status !== 0) {
    throw new Error('SignallingWebServer dependency kurulumu basarisiz oldu.');
  }

  if (!hasRuntimeDependenciesInstalled(targetDir)) {
    throw new Error('Dependency kurulumu tamamlandi ancak gerekli paketler bulunamadi.');
  }
}

function hasUsableLocalSignalling(targetDir) {
  const copiedIndex = path.join(targetDir, 'dist', 'index.js');
  return existsFile(copiedIndex) && hasRuntimeDependenciesInstalled(targetDir);
}

function main() {
  if (hasUsableLocalSignalling(TARGET_DIR)) {
    console.log(`[fetch-signalling] Mevcut SignallingWebServer kullaniliyor: ${TARGET_DIR}`);
    return;
  }

  const candidates = getUeCandidates();
  if (candidates.length === 0) {
    throw new Error(
      `UE_5.x kurulumu bulunamadi. Taranan kokler: ${EPIC_ROOT_CANDIDATES.join(', ')}`,
    );
  }

  const best = findBestSource(candidates);
  if (!best) {
    throw new Error(
      'Pixel Streaming SignallingWebServer kaynagi bulunamadi. ' +
        'UE kurulumunda Engine/Plugins/Media/PixelStreaming/Resources/WebServers/SignallingWebServer/dist/index.js mevcut olmalidir.',
    );
  }

  copySignallingFolder(best.source.sourceDir, TARGET_DIR);
  installRuntimeDependencies(TARGET_DIR);

  const copiedIndex = path.join(TARGET_DIR, 'dist', 'index.js');
  if (!fs.existsSync(copiedIndex)) {
    throw new Error(`Kopyalama sonrasi beklenen dosya bulunamadi: ${copiedIndex}`);
  }

  console.log(`[fetch-signalling] Kaynak UE: ${best.candidate.folder}`);
  console.log(`[fetch-signalling] Kaynak klasor: ${best.source.sourceDir}`);
  console.log(`[fetch-signalling] Hedef klasor: ${TARGET_DIR}`);
  console.log('[fetch-signalling] SignallingWebServer basariyla kopyalandi.');
}

try {
  main();
} catch (error) {
  console.error('[fetch-signalling] Hata:', error instanceof Error ? error.message : error);
  process.exit(1);
}
