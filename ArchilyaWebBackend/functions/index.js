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

// ───────────────────────────────────────────────────────────────
// Domain Export — Active AI Job System: Supabase/Express Worker
//
// Legacy AI job modules (Cloud Tasks / Firestore) are DISABLED
// by default.  Set ENABLE_LEGACY_AI_JOBS=true to re-enable during
// a controlled migration window.  See docs/FAZ0_BACKEND_STABILIZATION.md
// ───────────────────────────────────────────────────────────────

// Non-AI domain modules (always active):
Object.assign(exports, require('./src/credits'));
Object.assign(exports, require('./src/workspaces'));
Object.assign(exports, require('./src/projects'));
Object.assign(exports, require('./src/payments'));
Object.assign(exports, require('./src/notifications'));
Object.assign(exports, require('./src/r2-admin'));
Object.assign(exports, require('./src/r2-user'));
Object.assign(exports, require('./src/contact'));

// Legacy AI job system (Cloud Tasks + Firestore) — FAZ 0 disabled
if (process.env.ENABLE_LEGACY_AI_JOBS === 'true') {
  console.info('[index] Legacy AI jobs ENABLED (Cloud Tasks / Firestore). This is NOT the default path.');
  Object.assign(exports, require('./src/ai-jobs'));     // Cloud Tasks queue handlers
  Object.assign(exports, require('./src/ai-legacy'));   // Firestore-based AI tools
} else {
  console.info('[index] Legacy AI jobs DISABLED. Active AI system: Supabase/Express worker.');
}

// Legacy user management helpers (non-AI, still active):
Object.assign(exports, require('./src/legacy'));
