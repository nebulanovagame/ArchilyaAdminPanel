/**
 * Archilya Backend — Environment Validation
 *
 * Startup'ta kritik ortam değişkenlerini doğrular.
 * Eksik veya geçersiz config varsa fail-fast yapar.
 * Secret değerler asla loglanmaz.
 *
 * Kullanım:
 *   const env = require('./src/config/env');
 *   env.validate();  // startup'ta çağır
 *   const maxAttempts = env.get('AI_STUDIO_MAX_ATTEMPTS');  // 3
 */

'use strict';

function raw(key) {
  return process.env[key];
}

function parseInteger(rawValue, key) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`[env] ${key} must be a valid integer, got: "${rawValue}"`);
  }
  if (!Number.isInteger(parsed)) {
    throw new Error(`[env] ${key} must be an integer, got: "${rawValue}"`);
  }
  return parsed;
}

// ─── Internal validated config store ──────────────────────────────────────────
const CONFIG = {};

/**
 * Validate all critical environment variables at startup.
 * Throws with a descriptive message if any check fails.
 */
function validate() {
  const errors = [];

  // ── Mandatory ────────────────────────────────────────────────────────────
  if (!raw('SUPABASE_URL')) errors.push('SUPABASE_URL is required');
  if (!raw('SUPABASE_SERVICE_ROLE_KEY')) errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!raw('GEMINI_API_KEY')) errors.push('GEMINI_API_KEY is required');
  if (!raw('INTERNAL_PROCESS_SECRET')) errors.push('INTERNAL_PROCESS_SECRET is required');

  // ── AI retry config — numeric —─────────────────────────────────────────
  let v;

  v = raw('AI_STUDIO_MAX_ATTEMPTS');
  if (v !== undefined) {
    const n = parseInteger(v, 'AI_STUDIO_MAX_ATTEMPTS');
    if (n < 1 || n > 10) errors.push('AI_STUDIO_MAX_ATTEMPTS must be 1-10');
    CONFIG.AI_STUDIO_MAX_ATTEMPTS = n;
  } else {
    CONFIG.AI_STUDIO_MAX_ATTEMPTS = 3; // default
  }

  v = raw('AI_STUDIO_MAX_PROVIDER_RETRIES');
  if (v !== undefined) {
    const n = parseInteger(v, 'AI_STUDIO_MAX_PROVIDER_RETRIES');
    if (n < 0 || n > 5) errors.push('AI_STUDIO_MAX_PROVIDER_RETRIES must be 0-5');
    CONFIG.AI_STUDIO_MAX_PROVIDER_RETRIES = n;
  } else {
    CONFIG.AI_STUDIO_MAX_PROVIDER_RETRIES = 2; // default
  }

  v = raw('AI_STUDIO_RETRY_DELAY_MS');
  if (v !== undefined) {
    const n = parseInteger(v, 'AI_STUDIO_RETRY_DELAY_MS');
    if (n < 100 || n > 60000) errors.push('AI_STUDIO_RETRY_DELAY_MS must be 100-60000');
    CONFIG.AI_STUDIO_RETRY_DELAY_MS = n;
  } else {
    CONFIG.AI_STUDIO_RETRY_DELAY_MS = 2000; // default
  }

  v = raw('AI_STUDIO_STALE_LOCK_MINUTES');
  if (v !== undefined) {
    const n = parseInteger(v, 'AI_STUDIO_STALE_LOCK_MINUTES');
    if (n < 1 || n > 120) errors.push('AI_STUDIO_STALE_LOCK_MINUTES must be 1-120');
    CONFIG.AI_STUDIO_STALE_LOCK_MINUTES = n;
  } else {
    CONFIG.AI_STUDIO_STALE_LOCK_MINUTES = 15; // default
  }

  v = raw('AI_STUDIO_DEAD_LETTER_AFTER_MINUTES');
  if (v !== undefined) {
    const n = parseInteger(v, 'AI_STUDIO_DEAD_LETTER_AFTER_MINUTES');
    if (n < 1 || n > 1440) errors.push('AI_STUDIO_DEAD_LETTER_AFTER_MINUTES must be 1-1440');
    CONFIG.AI_STUDIO_DEAD_LETTER_AFTER_MINUTES = n;
  } else {
    CONFIG.AI_STUDIO_DEAD_LETTER_AFTER_MINUTES = 60; // default
  }

  v = raw('AI_STUDIO_PROCESS_BATCH_SIZE');
  if (v !== undefined) {
    const n = parseInteger(v, 'AI_STUDIO_PROCESS_BATCH_SIZE');
    if (n < 1 || n > 20) errors.push('AI_STUDIO_PROCESS_BATCH_SIZE must be 1-20');
    CONFIG.AI_STUDIO_PROCESS_BATCH_SIZE = n;
  } else {
    CONFIG.AI_STUDIO_PROCESS_BATCH_SIZE = 2; // default
  }

  // ── R2 storage ─────────────────────────────────────────────────────────
  CONFIG.R2_ENDPOINT = raw('R2_ENDPOINT') || '';
  CONFIG.R2_ACCESS_KEY_ID = raw('R2_ACCESS_KEY_ID') || '';
  CONFIG.R2_SECRET_ACCESS_KEY = raw('R2_SECRET_ACCESS_KEY') || '';
  CONFIG.R2_BUCKET_NAME = raw('R2_BUCKET_NAME') || '';

  // ── Feature flags ──────────────────────────────────────────────────────
  CONFIG.ENABLE_LEGACY_AI_JOBS = raw('ENABLE_LEGACY_AI_JOBS') === 'true';
  CONFIG.AI_STUDIO_WORKER_ENABLED = raw('AI_STUDIO_WORKER_ENABLED') || '';
  CONFIG.AI_STUDIO_BILLING_MODE = raw('AI_STUDIO_BILLING_MODE') || '';

  // ── Runtime ────────────────────────────────────────────────────────────
  CONFIG.NODE_ENV = raw('NODE_ENV') || 'production';
  CONFIG.PORT = raw('PORT') ? parseInteger(raw('PORT'), 'PORT') : 8080;

  if (errors.length > 0) {
    const msg = '[env] Configuration validation FAILED:\n  ' + errors.join('\n  ');
    console.error(msg);
    throw new Error(msg);
  }

  console.info('[env] All configuration checks passed', {
    legacyAiJobs: CONFIG.ENABLE_LEGACY_AI_JOBS,
    nodeEnv: CONFIG.NODE_ENV,
    maxAttempts: CONFIG.AI_STUDIO_MAX_ATTEMPTS,
    maxProviderRetries: CONFIG.AI_STUDIO_MAX_PROVIDER_RETRIES,
    staleLockMinutes: CONFIG.AI_STUDIO_STALE_LOCK_MINUTES,
  });
}

/**
 * Return a validated config value.
 * Falls back to process.env for unregistered keys.
 */
function get(key) {
  if (key in CONFIG) return CONFIG[key];
  return process.env[key];
}

/**
 * Return validated config snapshot (safe for health checks — no secrets).
 */
function getPublicSummary() {
  return {
    nodeEnv: CONFIG.NODE_ENV,
    legacyAiJobsEnabled: CONFIG.ENABLE_LEGACY_AI_JOBS,
    aiStudio: {
      maxAttempts: CONFIG.AI_STUDIO_MAX_ATTEMPTS,
      maxProviderRetries: CONFIG.AI_STUDIO_MAX_PROVIDER_RETRIES,
      retryDelayMs: CONFIG.AI_STUDIO_RETRY_DELAY_MS,
      staleLockMinutes: CONFIG.AI_STUDIO_STALE_LOCK_MINUTES,
      deadLetterAfterMinutes: CONFIG.AI_STUDIO_DEAD_LETTER_AFTER_MINUTES,
      batchSize: CONFIG.AI_STUDIO_PROCESS_BATCH_SIZE,
      billingMode: CONFIG.AI_STUDIO_BILLING_MODE,
    },
    r2Configured: Boolean(CONFIG.R2_ENDPOINT && CONFIG.R2_ACCESS_KEY_ID && CONFIG.R2_BUCKET_NAME),
    legacyAiJobs: CONFIG.ENABLE_LEGACY_AI_JOBS,
    aiJobSystem: 'supabase-express-worker',
    validatedAt: new Date().toISOString(),
  };
}

module.exports = { validate, get, getPublicSummary };