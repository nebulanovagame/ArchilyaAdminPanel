/**
 * Archilya Backend — Express Server Entry Point
 *
 * FAZ 0:
 *   - Sentry initialization for Express runtime
 *   - Graceful shutdown (SIGTERM / SIGINT)
 *   - Worker lifecycle management
 */

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
  integrations: [],
});

const { app } = require('./src/app');
const { startAiStudioWorker, gracefulShutdown } = require('./src/ai-jobs/worker');

const port = Number(process.env.PORT || 8080);

const server = app.listen(port, () => {
  console.info(`[archilya-backend] Express API listening on ${port}`);
  startAiStudioWorker();
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
function handleShutdown(signal) {
  console.info(`[server] Received ${signal}, starting graceful shutdown...`);
  Sentry.captureMessage(`Server shutdown: ${signal}`, { level: 'info' });
  server.close(() => {
    console.info('[server] HTTP server closed');
    gracefulShutdown().then(() => {
      console.info('[server] Graceful shutdown complete');
      process.exit(0);
    });
  });
  // Force exit after 15 seconds
  setTimeout(() => {
    console.error('[server] Forced exit after shutdown timeout');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));