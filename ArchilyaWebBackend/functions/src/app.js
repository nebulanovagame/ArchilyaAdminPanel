const express = require('express');
const cors = require('cors');
const Sentry = require('@sentry/node');
const env = require('./config/env');
const { supabase } = require('./shared/supabase');
const { toHttpStatus } = require('./shared/http-callable');
const { runHealthChecks } = require('./shared/health-check');

const credits = require('./credits');
const workspaces = require('./workspaces');
const projects = require('./projects/express');
const aiJobs = require('./ai-jobs/express');
const notifications = require('./notifications/express');
const contact = require('./contact/express');
const { processAiStudioJob } = require('./ai-jobs/processor');
const { runAiStudioWorkerScan } = require('./ai-jobs/worker');
const adminRouter = require('./admin');

const callableHandlers = {
  ...credits,
  ...workspaces,
  ...projects,
  ...aiJobs,
  ...notifications,
  ...contact,
};

// ── FAZ 0: Startup env validation ─────────────────────────────────────────────
try {
  env.validate();
  console.info('[app] Environment validation passed');
} catch (err) {
  console.error('[app] Environment validation FAILED — exiting', err.message);
  process.exit(1);
}

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

// Structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.info(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      service: 'http',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.headers['x-forwarded-for'] || req.ip || 'unknown',
    }));
  });
  next();
});

async function resolveAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return {
    uid: data.user.id,
    token: {
      email: data.user.email || '',
      name: data.user.user_metadata?.display_name || data.user.user_metadata?.name || '',
    },
  };
}

app.get('/health', async (_req, res) => {
  try {
    const health = await runHealthChecks();
    const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    Sentry.captureException(err);
    res.status(503).json({
      status: 'down',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/health/deep', async (_req, res) => {
  try {
    const health = await runHealthChecks();
    const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json({
      ...health,
      _note: 'Deep health endpoint — operational visibility only. No secrets exposed.',
    });
  } catch (err) {
    Sentry.captureException(err);
    res.status(503).json({
      status: 'down',
      error: 'Deep health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Admin API routes (for AdminPanel)
app.use('/admin', adminRouter);

app.post('/call/:functionName', async (req, res) => {
  const handler = callableHandlers[req.params.functionName];
  if (!handler) {
    res.status(404).json({ error: { code: 'not-found', message: 'Fonksiyon bulunamadi.' } });
    return;
  }

  try {
    const auth = await resolveAuth(req);
    if (auth?.uid) {
      Sentry.setUser({ id: auth.uid, email: auth.token?.email || undefined });
    }
    Sentry.setTag('function', req.params.functionName);
    Sentry.setContext('call', {
      functionName: req.params.functionName,
      userId: auth?.uid || 'anonymous',
    });

    const bodySize = JSON.stringify(req.body || {}).length;
    if (bodySize > 25 * 1024 * 1024) {
      res.status(413).json({ error: { code: 'invalid-argument', message: 'Istek boyutu cok buyuk.' } });
      return;
    }

    const result = await handler({
      auth,
      data: req.body?.data ?? req.body ?? {},
      rawRequest: req,
    });

    res.json({ data: result });
  } catch (error) {
    Sentry.captureException(error);
    const code = error.code || 'internal';
    res.status(toHttpStatus(code)).json({
      error: {
        code,
        message: error.message || 'Beklenmeyen hata.',
        details: error.details,
      },
    });
  }
});

function assertInternalRequest(req) {
  const expected = process.env.INTERNAL_PROCESS_SECRET || '';
  if (!expected) {
    const error = new Error('INTERNAL_PROCESS_SECRET is required for AI job processing.');
    error.code = 'failed-precondition';
    throw error;
  }
  const provided = req.headers['x-internal-secret'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    const error = new Error('Internal endpoint secret is invalid.');
    error.code = 'permission-denied';
    throw error;
  }
}

app.post('/internal/process-ai-jobs', async (req, res) => {
  try {
    Sentry.setTag('function', 'process-ai-jobs');
    Sentry.setContext('internal', { jobId: req.body?.jobId || 'batch' });
    assertInternalRequest(req);
    const jobId = String(req.body?.jobId || '').trim();
    const result = jobId
      ? await processAiStudioJob(jobId)
      : await runAiStudioWorkerScan('internal-endpoint');
    res.json({ data: result });
  } catch (error) {
    Sentry.captureException(error);
    const code = error.code || 'internal';
    res.status(toHttpStatus(code)).json({ error: { code, message: error.message || 'Beklenmeyen hata.' } });
  }
});

module.exports = { app, callableHandlers };
