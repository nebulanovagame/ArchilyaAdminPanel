/**
 * Archilya Backend — Health Check Helper
 *
 * Production'da sistem sagligini kontrol eder.
 * Secret degerler asla response'a sizmaz.
 *
 * FAZ 0 eklentileri:
 *   - uptime, version, memory usage
 *   - env validation state
 *   - retry config summary
 *   - legacy AI job state
 *   - queue health (basic)
 */

const { supabase } = require('./supabase-helpers');
const env = require('../config/env');
const { getGeminiConfigSummary } = require('../ai-jobs/gemini');

// ── Version ───────────────────────────────────────────────────────────────────
const PACKAGE_VERSION = process.env.npm_package_version || 'unknown';

async function checkSupabase() {
  try {
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    return { status: error ? 'degraded' : 'ok', detail: error ? error.message : 'connected' };
  } catch (err) {
    return { status: 'down', detail: err?.message || 'unknown' };
  }
}

async function checkStorage() {
  try {
    const { data, error } = await supabase.storage.getBucket('ai-studio');
    return { status: error ? 'degraded' : 'ok', detail: error ? error.message : 'accessible' };
  } catch (err) {
    return { status: 'down', detail: err?.message || 'unknown' };
  }
}

function checkGeminiConfig() {
  const config = getGeminiConfigSummary();
  return {
    status: config.keyConfigured ? 'configured' : 'missing',
    detail: config.keyConfigured ? null : 'GEMINI_API_KEY missing or too short',
    imageModel: config.imageModel,
    imageFallback: config.imageFallback,
    textModel: config.textModel,
    textFallback: config.textFallback,
    configVersion: config.configVersion,
  };
}

function checkR2Config() {
  const hasEndpoint = Boolean(process.env.R2_ENDPOINT || process.env.R2_ENDPOINTS);
  const hasBucket = Boolean(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET_NAMES);
  const hasKeys = Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
  if (hasEndpoint && hasBucket && hasKeys) {
    return { status: 'configured', detail: null };
  }
  return { status: 'missing', detail: 'R2_ENDPOINT, R2_BUCKET_NAME or R2_ACCESS_KEY_ID missing' };
}

function checkMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rssMb: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    heapTotalMb: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsedMb: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    externalMb: Math.round(usage.external / 1024 / 1024 * 100) / 100,
  };
}

/**
 * Lightweight health check (no async DB calls beyond Supabase).
 */
async function runHealthChecks() {
  const [supabaseCheck, storageCheck] = await Promise.all([checkSupabase(), checkStorage()]);
  const geminiCheck = checkGeminiConfig();
  const r2Check = checkR2Config();
  const mem = checkMemoryUsage();
  const envSummary = env.getPublicSummary();

  const checks = {
    supabase: supabaseCheck.status,
    storage: storageCheck.status,
    gemini: geminiCheck.status,
    r2: r2Check.status,
  };

  const statuses = Object.values(checks);
  const overall = statuses.includes('down')
    ? 'down'
    : statuses.includes('degraded') || statuses.includes('missing')
      ? 'degraded'
      : 'ok';

  return {
    status: overall,
    checks,
    details: {
      supabase: supabaseCheck.detail,
      storage: storageCheck.detail,
      gemini: geminiCheck.detail,
      r2: r2Check.detail,
    },
    // ── FAZ 0 ek bilgiler ─────────────────────────────────────────────
    uptime: Math.floor(process.uptime()),
    version: PACKAGE_VERSION,
    nodeVersion: process.version,
    memory: mem,
    envValidation: 'validated',
    retryConfig: {
      maxAttempts: envSummary.aiStudio.maxAttempts,
      maxProviderRetries: envSummary.aiStudio.maxProviderRetries,
      retryDelayMs: envSummary.aiStudio.retryDelayMs,
      staleLockMinutes: envSummary.aiStudio.staleLockMinutes,
      deadLetterAfterMinutes: envSummary.aiStudio.deadLetterAfterMinutes,
    },
    legacyAiJobsEnabled: envSummary.legacyAiJobsEnabled,
    activeAiJobSystem: envSummary.aiJobSystem,
    queueHealth: null, // queue health requires runtime stats — TBD in deeper check
    timestamp: new Date().toISOString(),
  };
}

module.exports = { runHealthChecks };