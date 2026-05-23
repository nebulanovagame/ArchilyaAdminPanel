/* ───────────────────────────────────────────────────────────────
   Archilya Functions — Main Barrel (domain-based modular layout)
   ─────────────────────────────────────────────────────────────── */

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
  integrations: [],
});

function wrapHandler(handler, name) {
  return async (...args) => {
    try {
      const req = args[0];
      if (req?.auth?.uid) {
        Sentry.setUser({ id: req.auth.uid, email: req.auth.token?.email || undefined });
      }
      if (name) {
        Sentry.setTag('function', name);
      }
      return await handler(...args);
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  };
}

/* Set global function options for performance and cost optimization */
const { setGlobalOptions } = require('firebase-functions/v2');
setGlobalOptions({
  region: 'europe-west1',
  memory: '512MiB',
  cpu: 1,
  concurrency: 80,
  minInstances: 1,
  maxInstances: 10,
});

/* Patch firebase-functions/v2/https so every onCall / onRequest handler
   is automatically wrapped with Sentry error reporting.               */
const https = require('firebase-functions/v2/https');
const origOnCall = https.onCall;
https.onCall = function (opts, handler) {
  if (typeof opts === 'function') {
    handler = opts;
    opts = {};
  }
  return origOnCall.call(https, opts, wrapHandler(handler, handler?.name || 'onCall'));
};
const origOnRequest = https.onRequest;
https.onRequest = function (opts, handler) {
  if (typeof opts === 'function') {
    handler = opts;
    opts = {};
  }
  return origOnRequest.call(https, opts, wrapHandler(handler, handler?.name || 'onRequest'));
};

/* Patch firebase-functions/v2/tasks for queue handlers                 */
const tasks = require('firebase-functions/v2/tasks');
const origOnTaskDispatched = tasks.onTaskDispatched;
tasks.onTaskDispatched = function (opts, handler) {
  if (typeof opts === 'function') {
    handler = opts;
    opts = {};
  }
  return origOnTaskDispatched.call(tasks, opts, wrapHandler(handler, handler?.name || 'onTaskDispatched'));
};

// Re-export every domain so Firebase Functions discovers the handlers.
// Shared helpers live in src/shared and are imported by each domain internally.
Object.assign(exports, require('./src/ai-jobs'));
Object.assign(exports, require('./src/credits'));
Object.assign(exports, require('./src/workspaces'));
Object.assign(exports, require('./src/projects'));
Object.assign(exports, require('./src/payments'));
Object.assign(exports, require('./src/notifications'));
Object.assign(exports, require('./src/ai-legacy'));
Object.assign(exports, require('./src/r2-admin'));
Object.assign(exports, require('./src/r2-user'));
Object.assign(exports, require('./src/contact'));
Object.assign(exports, require('./src/legacy'));
