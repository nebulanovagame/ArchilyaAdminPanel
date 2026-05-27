const { processQueuedAiStudioJobs } = require('./processor');

const DEFAULT_INTERVAL_MS = 15000;
const DEFAULT_BATCH_SIZE = 5;

let intervalHandle = null;
let running = false;

function isWorkerEnabled() {
  const value = String(process.env.AI_STUDIO_WORKER_ENABLED || '').toLowerCase();
  if (value === 'false' || value === '0' || value === 'off') return false;
  if (value === 'true' || value === '1' || value === 'on') return true;
  return process.env.NODE_ENV !== 'production';
}

async function runAiStudioWorkerScan(source = 'manual') {
  if (running) {
    console.info('[ai-jobs] worker scan skipped; previous scan still running', { source });
    return { skipped: true, reason: 'already-running' };
  }

  running = true;
  try {
    const limit = Number(process.env.AI_STUDIO_WORKER_BATCH_SIZE || process.env.AI_STUDIO_PROCESS_BATCH_SIZE || DEFAULT_BATCH_SIZE);
    const result = await processQueuedAiStudioJobs({ limit });
    console.info('[ai-jobs] worker scan completed', { source, processed: result.processed });
    return result;
  } catch (error) {
    console.error('[ai-jobs] worker scan failed', { source, message: error.message });
    return { success: false, error: { message: error.message, code: error.code || 'internal' } };
  } finally {
    running = false;
  }
}

function startAiStudioWorker() {
  if (!isWorkerEnabled()) {
    console.info('[ai-jobs] interval worker disabled');
    return { enabled: false };
  }

  if (intervalHandle) return { enabled: true, alreadyStarted: true };

  const intervalMs = Math.max(5000, Number(process.env.AI_STUDIO_WORKER_INTERVAL_MS || DEFAULT_INTERVAL_MS));
  console.info('[ai-jobs] interval worker starting', { intervalMs });
  void runAiStudioWorkerScan('startup');
  intervalHandle = setInterval(() => {
    void runAiStudioWorkerScan('interval');
  }, intervalMs);
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
  return { enabled: true, intervalMs };
}

function stopAiStudioWorker() {
  if (!intervalHandle) {
    console.info('[ai-jobs] interval worker already stopped');
    return;
  }
  clearInterval(intervalHandle);
  intervalHandle = null;
  console.info('[ai-jobs] interval worker stopped');
}

function isRunning() {
  return running;
}

async function gracefulShutdown() {
  console.info('[ai-jobs] graceful shutdown requested');
  stopAiStudioWorker();
  if (running) {
    console.info('[ai-jobs] waiting for active scan to complete...');
    // Wait up to 30s for active scan to finish
    const maxWait = 30000;
    const interval = 500;
    let waited = 0;
    while (running && waited < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      waited += interval;
    }
    if (running) {
      console.warn('[ai-jobs] active scan did not finish within timeout');
    } else {
      console.info('[ai-jobs] active scan completed');
    }
  }
  console.info('[ai-jobs] shutdown complete');
}

module.exports = { runAiStudioWorkerScan, startAiStudioWorker, stopAiStudioWorker, isWorkerEnabled, isRunning, gracefulShutdown };
