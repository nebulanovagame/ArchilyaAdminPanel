const express = require('express');
const cors = require('cors');
const Sentry = require('@sentry/node');
const { supabase } = require('./shared/supabase');
const { toHttpStatus } = require('./shared/http-callable');

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

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'archilya-backend', runtime: 'express' });
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
